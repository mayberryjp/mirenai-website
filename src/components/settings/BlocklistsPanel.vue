<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useBlocklistsStore } from "@/stores/blocklists";
import { searchBlocklistDomains } from "@/services/blocklists";
import { listTopBlocked } from "@/services/queries";
import { getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import BlocklistTrafficChart from "@/components/dashboard/BlocklistTrafficChart.vue";
import type {
  Blocklist,
  BlocklistCreate,
  BlocklistMatch,
  BlocklistOverride,
  SiteHourlyStat,
  TopBlockedDomain
} from "@/types/domain";

const store = useBlocklistsStore();
const { items, loading, error, refreshingId, overrides, overridesLoading, overridesError } =
  storeToRefs(store);

const headers = [
  { title: "Source", key: "url" },
  { title: "Interval", key: "update_interval_hours" },
  { title: "Domains", key: "domain_count" },
  { title: "Last updated", key: "last_downloaded_at" },
  { title: "Status", key: "last_status" },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const }
];

// Combined enabled + status: a disabled list reads "disabled"; otherwise the
// last run outcome (OK / failed / never run).
function statusColor(item: Blocklist): string {
  if (!item.enabled) return "grey";
  const status = item.last_status;
  if (!status) return "grey";
  const s = status.toLowerCase();
  if (s.includes("ok") || s.includes("success")) return "success";
  if (s.includes("fail") || s.includes("error")) return "error";
  return "info";
}

function statusIcon(item: Blocklist): string {
  if (!item.enabled) return "mdi-cancel";
  const status = item.last_status;
  if (!status) return "mdi-clock-outline";
  const s = status.toLowerCase();
  if (s.includes("ok") || s.includes("success")) return "mdi-check-circle";
  if (s.includes("fail") || s.includes("error")) return "mdi-alert-circle";
  return "mdi-information";
}

function statusLabel(item: Blocklist): string {
  if (!item.enabled) return "disabled";
  const status = item.last_status;
  if (!status || !status.trim()) return "never run";
  // Backend embeds the domain count (e.g. "ok: 75945 domains") — show just the status.
  return status.replace(/:.*$/, "").trim();
}

function formatUpdated(ts: string | null): string {
  if (!ts) return "never";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface BlocklistForm {
  url: string;
  update_interval_hours: number;
  enabled: boolean;
}

function emptyForm(): BlocklistForm {
  return { url: "", update_interval_hours: 24, enabled: true };
}

const dialog = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<BlocklistForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

function openEdit(row: Blocklist): void {
  editingId.value = row.id;
  Object.assign(form, {
    url: row.url,
    update_interval_hours: row.update_interval_hours,
    enabled: row.enabled
  });
  formError.value = null;
  dialog.value = true;
}

async function submit(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const body: BlocklistCreate = {
    url: form.url.trim(),
    update_interval_hours: form.update_interval_hours,
    enabled: form.enabled
  };
  try {
    if (editingId.value === null) {
      await store.create(body);
    } else {
      await store.update(editingId.value, body);
    }
    dialog.value = false;
  } catch (e) {
    formError.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

const refreshError = ref<string | null>(null);

async function refresh(row: Blocklist): Promise<void> {
  refreshError.value = null;
  try {
    await store.refresh(row.id);
  } catch (e) {
    // 502 download_failed carries a detail explaining why (spec §7.4).
    refreshError.value = apiErrorMessage(e);
  }
}

const confirmDelete = ref<Blocklist | null>(null);
const deleting = ref(false);

async function remove(): Promise<void> {
  if (!confirmDelete.value) return;
  deleting.value = true;
  try {
    await store.remove(confirmDelete.value.id);
    confirmDelete.value = null;
  } finally {
    deleting.value = false;
  }
}

// Domain lookup: "is this domain on a blocklist, and which one?" (GET /blocklists/lookup).
const lookupQuery = ref("");
const lookupResults = ref<BlocklistMatch[]>([]);
const lookupLoading = ref(false);
const lookupError = ref<string | null>(null);
const lookupSearched = ref(false);

async function runLookup(): Promise<void> {
  const q = lookupQuery.value.trim();
  if (!q) return;
  lookupLoading.value = true;
  lookupError.value = null;
  try {
    const page = await searchBlocklistDomains(q, 100);
    lookupResults.value = page.items;
    lookupSearched.value = true;
  } catch (e) {
    lookupError.value = apiErrorMessage(e);
    lookupResults.value = [];
    lookupSearched.value = false;
  } finally {
    lookupLoading.value = false;
  }
}

// Last 100 hours of blocklist-denied traffic for the bottom chart (GET /stats/site).
const siteStats = ref<SiteHourlyStat[]>([]);
const siteLoading = ref(true);
const siteError = ref<string | null>(null);

async function loadSiteStats(): Promise<void> {
  siteLoading.value = true;
  siteError.value = null;
  try {
    siteStats.value = await getSiteStats(100);
  } catch (e) {
    siteError.value = apiErrorMessage(e);
    siteStats.value = [];
  } finally {
    siteLoading.value = false;
  }
}

// ---- Overrides (allowlist): domains stripped from blocklists at download time ----
const overrideHeaders = [
  { title: "Domain", key: "domain" },
  { title: "Added", key: "created_at" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

// Shown after a mutation: overrides only apply once each blocklist is reloaded.
const overrideReloadNote = ref(false);

// Domains already allowlisted — lets the "Add to overrides" buttons reflect state.
const overrideDomainSet = computed(() => new Set(overrides.value.map((o) => o.domain)));

// Overrides are added from the lookup results or top-blocked table (one in flight).
const addingOverride = ref<string | null>(null);
const overrideActionError = ref<string | null>(null);

async function addToOverrides(domain: string): Promise<void> {
  if (!domain || addingOverride.value || overrideDomainSet.value.has(domain)) return;
  addingOverride.value = domain;
  overrideActionError.value = null;
  try {
    await store.addOverride(domain);
    overrideReloadNote.value = true;
  } catch (e) {
    overrideActionError.value = apiErrorMessage(e);
  } finally {
    addingOverride.value = null;
  }
}

const confirmDeleteOverride = ref<BlocklistOverride | null>(null);
const overrideDeleting = ref(false);

async function removeOverride(): Promise<void> {
  if (!confirmDeleteOverride.value) return;
  overrideDeleting.value = true;
  try {
    await store.removeOverride(confirmDeleteOverride.value.id);
    confirmDeleteOverride.value = null;
    overrideReloadNote.value = true;
  } finally {
    overrideDeleting.value = false;
  }
}

// ---- Top blocked domains (read-only; GET /queries/top-blocked) ----
// Fetch the top 50 and page through them client-side, 25 per page.
const TOP_BLOCKED_LIMIT = 50;
const TOP_BLOCKED_PAGE_SIZE = 25;

const topBlockedHeaders = [
  { title: "Domain", key: "domain" },
  { title: "Count", key: "count" },
  { title: "Clients", key: "clients", sortable: false },
  { title: "Blocklists", key: "blocklists", sortable: false },
  { title: "Last seen", key: "last_seen" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

const topBlocked = ref<TopBlockedDomain[]>([]);
const topBlockedLoading = ref(false);
const topBlockedError = ref<string | null>(null);
const topBlockedPage = ref(1);
const topBlockedPageCount = computed(() =>
  Math.max(1, Math.ceil(topBlocked.value.length / TOP_BLOCKED_PAGE_SIZE))
);

async function loadTopBlocked(): Promise<void> {
  topBlockedLoading.value = true;
  topBlockedError.value = null;
  try {
    const res = await listTopBlocked(TOP_BLOCKED_LIMIT);
    topBlocked.value = res.items;
    topBlockedPage.value = 1;
  } catch (e) {
    topBlockedError.value = apiErrorMessage(e);
  } finally {
    topBlockedLoading.value = false;
  }
}

onMounted(() => {
  void store.load();
  void store.loadOverrides();
  void loadTopBlocked();
  void loadSiteStats();
});
</script>

<template>
  <div>
    <!-- Domain lookup: which blocklist (if any) contains a domain -->
    <v-sheet
      rounded="lg"
      color="#090c10"
      class="pa-4 mb-4"
    >
      <div class="lookup-heading mb-1">
        Blocklist lookup
      </div>
      <div class="text-body-2 text-medium-emphasis mb-3">
        Type a domain (or part of one) to check whether it appears on any blocklist.
      </div>
      <div class="d-flex ga-2 align-center">
        <v-text-field
          v-model="lookupQuery"
          label="Domain or partial domain"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          :loading="lookupLoading"
          @keyup.enter="runLookup"
        />
        <v-btn
          color="primary"
          :loading="lookupLoading"
          :disabled="!lookupQuery.trim()"
          @click="runLookup"
        >
          Search
        </v-btn>
      </div>

      <v-alert
        v-if="lookupError"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-3"
      >
        {{ lookupError }}
      </v-alert>

      <div
        v-else-if="lookupSearched && lookupResults.length === 0"
        class="d-flex align-center ga-2 mt-3 text-success"
      >
        <v-icon size="18">
          mdi-check-circle
        </v-icon>
        <span>Not found on any blocklist.</span>
      </div>

      <div
        v-else-if="lookupResults.length"
        class="lookup-results mt-3"
      >
        <div class="text-caption text-medium-emphasis mb-2">
          {{ lookupResults.length }} match{{ lookupResults.length === 1 ? "" : "es" }}
        </div>
        <div
          v-for="m in lookupResults"
          :key="`${m.blocklist_id}:${m.domain}`"
          class="d-flex align-center ga-2 py-1"
        >
          <v-icon
            size="16"
            color="error"
          >
            mdi-cancel
          </v-icon>
          <span class="lookup-domain">{{ m.domain }}</span>
          <span class="text-medium-emphasis">on</span>
          <span class="lookup-source">{{ m.blocklist_name ?? `blocklist #${m.blocklist_id}` }}</span>
          <v-spacer />
          <v-btn
            v-if="overrideDomainSet.has(m.domain)"
            size="x-small"
            variant="tonal"
            color="success"
            prepend-icon="mdi-check"
            disabled
          >
            Overridden
          </v-btn>
          <v-btn
            v-else
            size="x-small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            :loading="addingOverride === m.domain"
            @click="addToOverrides(m.domain)"
          >
            Add to overrides
          </v-btn>
        </div>
      </div>
    </v-sheet>

    <div class="d-flex align-center mb-4 ga-3">
      <div class="text-body-2 text-medium-emphasis">
        Domain blocklists are downloaded and refreshed on a schedule.
      </div>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New blocklist
      </v-btn>
    </div>

    <v-alert
      v-if="refreshError"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="refreshError = null"
    >
      {{ refreshError }}
    </v-alert>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No blocklists configured."
    >
      <v-sheet
        rounded="lg"
        color="#090c10"
      >
        <v-data-table
          :headers="headers"
          :items="items"
          density="compact"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="-1"
          hide-default-footer
        >
          <template #item.url="{ item }">
            <div class="d-flex align-center">
              <v-icon
                size="16"
                class="mr-2 text-medium-emphasis"
              >
                mdi-link-variant
              </v-icon>
              <span
                class="source-url"
                :title="item.url"
              >{{ item.url }}</span>
            </div>
          </template>
          <template #item.update_interval_hours="{ item }">
            <span class="text-medium-emphasis">every {{ item.update_interval_hours }}h</span>
          </template>
          <template #item.domain_count="{ item }">
            <span class="font-weight-medium">{{ item.domain_count.toLocaleString() }}</span>
          </template>
          <template #item.last_downloaded_at="{ item }">
            <span class="date-column">{{ formatUpdated(item.last_downloaded_at) }}</span>
          </template>
          <template #item.last_status="{ item }">
            <v-chip
              :color="statusColor(item)"
              size="small"
              variant="tonal"
            >
              <v-icon
                start
                size="14"
              >
                {{ statusIcon(item) }}
              </v-icon>
              {{ statusLabel(item) }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-refresh"
              variant="text"
              size="small"
              :loading="refreshingId === item.id"
              title="Refresh now"
              @click="refresh(item)"
            />
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              @click="openEdit(item)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              @click="confirmDelete = item"
            />
          </template>
        </v-data-table>
      </v-sheet>
    </AsyncState>

    <!-- Overrides (allowlist): domains stripped from blocklists at download time -->
    <div class="mt-8 mb-2">
      <h3 class="text-subtitle-1 font-weight-medium">
        Blocklist overrides
      </h3>
      <p class="text-caption text-medium-emphasis mb-0">
        Domains listed here are excluded (allowlisted) from every blocklist. Add one from the
        blocklist lookup above or the top blocked domains below.
      </p>
    </div>

    <v-alert
      v-if="overrideActionError"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="overrideActionError = null"
    >
      {{ overrideActionError }}
    </v-alert>

    <v-alert
      v-if="overrideReloadNote"
      type="info"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="overrideReloadNote = false"
    >
      A blocklist has to be reloaded for the blocklist override to take effect — use the refresh
      action on each blocklist above.
    </v-alert>

    <AsyncState
      :loading="overridesLoading"
      :error="overridesError"
      :empty="overrides.length === 0"
      empty-text="No overrides configured."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="overrideHeaders"
          :items="overrides"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
        >
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              title="Remove override"
              @click="confirmDeleteOverride = item"
            />
          </template>
        </v-data-table>
      </v-card>
    </AsyncState>

    <!-- Top blocked domains (read-only insight from GET /queries/top-blocked) -->
    <div class="mt-8 mb-2">
      <h3 class="text-subtitle-1 font-weight-medium">
        Top blocked domains
      </h3>
      <p class="text-caption text-medium-emphasis mb-0">
        The most-blocked domains across all clients, ranked by blocked query count.
      </p>
    </div>

    <AsyncState
      :loading="topBlockedLoading"
      :error="topBlockedError"
      :empty="topBlocked.length === 0"
      empty-text="No blocked queries recorded yet."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="topBlockedHeaders"
          :items="topBlocked"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="TOP_BLOCKED_PAGE_SIZE"
          :page="topBlockedPage"
          hide-default-footer
        >
          <template #item.count="{ item }">
            {{ item.count.toLocaleString() }}
          </template>
          <template #item.clients="{ item }">
            <template v-if="item.clients.length">
              <v-chip
                v-for="c in item.clients"
                :key="c.client"
                size="small"
                variant="tonal"
                class="mr-1 mb-1"
              >
                {{ c.client }} ({{ c.count.toLocaleString() }})
              </v-chip>
            </template>
            <span v-else>—</span>
          </template>
          <template #item.blocklists="{ item }">
            <template v-if="item.blocklists.length">
              <v-chip
                v-for="b in item.blocklists"
                :key="b.blocklist_id"
                size="small"
                variant="tonal"
                class="mr-1 mb-1"
              >
                {{ b.blocklist_name }}
              </v-chip>
            </template>
            <span v-else>—</span>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              v-if="overrideDomainSet.has(item.domain)"
              size="small"
              variant="tonal"
              color="success"
              prepend-icon="mdi-check"
              disabled
            >
              Overridden
            </v-btn>
            <v-btn
              v-else
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-plus"
              :loading="addingOverride === item.domain"
              @click="addToOverrides(item.domain)"
            >
              Add to overrides
            </v-btn>
          </template>
        </v-data-table>
        <div
          v-if="topBlockedPageCount > 1"
          class="d-flex justify-center pa-2"
        >
          <v-pagination
            :model-value="topBlockedPage"
            :length="topBlockedPageCount"
            :total-visible="7"
            @update:model-value="topBlockedPage = $event"
          />
        </div>
      </v-card>
    </AsyncState>

    <BlocklistTrafficChart
      :stats="siteStats"
      :loading="siteLoading"
      :error="siteError"
      class="mt-4"
    />

    <v-dialog
      v-model="dialog"
      max-width="560"
    >
      <v-card>
        <v-card-title>{{ editingId === null ? "New blocklist" : "Edit blocklist" }}</v-card-title>
        <v-card-text>
          <v-alert
            v-if="formError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ formError }}
          </v-alert>
          <v-text-field
            v-model="form.url"
            label="Source URL (http/https)"
          />
          <v-text-field
            v-model.number="form.update_interval_hours"
            type="number"
            label="Update interval (hours, >= 1)"
          />
          <v-switch
            v-model="form.enabled"
            label="Enabled"
            color="primary"
          />
          <p class="text-caption text-medium-emphasis">
            New blocklists are not downloaded on create — use refresh to populate the domain count.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="dialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            @click="submit"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="confirmDelete !== null"
      max-width="440"
      @update:model-value="confirmDelete = null"
    >
      <v-card>
        <v-card-title>Delete blocklist</v-card-title>
        <v-card-text>
          Delete this blocklist (<strong>{{ confirmDelete?.url }}</strong>) and all its stored domains?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmDelete = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="remove"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="confirmDeleteOverride !== null"
      max-width="440"
      @update:model-value="confirmDeleteOverride = null"
    >
      <v-card>
        <v-card-title>Remove override</v-card-title>
        <v-card-text>
          Remove <strong>{{ confirmDeleteOverride?.domain }}</strong> from the allowlist?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmDeleteOverride = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="overrideDeleting"
            @click="removeOverride"
          >
            Remove
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.source-url {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.85rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.lookup-heading {
  font-size: 1.05rem;
  font-weight: 500;
  color: #b1b8c0;
}

.lookup-domain {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.85rem;
  color: #e6e9ee;
  overflow-wrap: anywhere;
}

.lookup-source {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: #8b949e;
  overflow-wrap: anywhere;
}
</style>
