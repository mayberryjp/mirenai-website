<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useLocalZonesStore } from "@/stores/localZones";
import { listLocalRecords } from "@/services/localZones";
import { getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import LocalTrafficChart from "@/components/dashboard/LocalTrafficChart.vue";
import type { LocalRecord, LocalZone, LocalZoneCreate, SiteHourlyStat } from "@/types/domain";

const store = useLocalZonesStore();
const { items, total, loading, error, refreshingId, refreshingAll } = storeToRefs(store);

// Last 100 hours of locally-answered query volume for the top chart (GET /stats/site).
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

// ---- Record sources (zones) ----
const zoneHeaders = [
  { title: "Source URL", key: "url" },
  { title: "Interval", key: "update_interval_seconds" },
  { title: "Records", key: "record_count", align: "end" as const },
  { title: "Last downloaded", key: "last_downloaded_at" },
  { title: "Status", key: "last_status" },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const }
];

// Refresh-interval presets, in seconds (the update_interval_seconds field).
const intervalOptions = [
  { title: "Hourly", value: 3600 },
  { title: "Every 6 hours", value: 21600 },
  { title: "Every 12 hours", value: 43200 },
  { title: "Daily", value: 86400 },
  { title: "Weekly", value: 604800 }
];

interface ZoneForm {
  url: string;
  update_interval_seconds: number;
}

function emptyForm(): ZoneForm {
  return { url: "", update_interval_seconds: 86400 };
}

const dialog = ref(false);
const form = reactive<ZoneForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

// The backend requires a zone name but we don't surface it, so generate a random
// one. crypto.randomUUID needs a secure context (absent over plain-http LAN), so
// fall back to a Math.random v4 UUID there.
function randomZoneName(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

async function submit(): Promise<void> {
  const url = form.url.trim();
  if (!url) {
    formError.value = "Source URL is required.";
    return;
  }
  saving.value = true;
  formError.value = null;
  // Backend requires a name but we don't show it — send a random one.
  const body: LocalZoneCreate = {
    name: randomZoneName(),
    url,
    update_interval_seconds: form.update_interval_seconds
  };
  try {
    await store.create(body);
    dialog.value = false;
    void loadRecords();
  } catch (e) {
    formError.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

const confirmDelete = ref<LocalZone | null>(null);
const deleting = ref(false);

async function remove(): Promise<void> {
  if (!confirmDelete.value) return;
  deleting.value = true;
  try {
    await store.remove(confirmDelete.value.id);
    confirmDelete.value = null;
    void loadRecords();
  } finally {
    deleting.value = false;
  }
}

const refreshError = ref<string | null>(null);

async function refresh(zone: LocalZone): Promise<void> {
  refreshError.value = null;
  try {
    await store.refresh(zone.id);
    void loadRecords();
  } catch (e) {
    // 502 download_failed carries a detail explaining why.
    refreshError.value = apiErrorMessage(e);
  }
}

async function refreshAll(): Promise<void> {
  refreshError.value = null;
  try {
    await store.refreshAll();
  } catch (e) {
    refreshError.value = apiErrorMessage(e);
  } finally {
    // Some zones may have refreshed even on partial failure — reload either way.
    void loadRecords();
  }
}

// Combined enabled + status: a disabled zone reads "disabled"; otherwise the last
// run outcome (OK / failed / never run), matching the blocklists status chip.
function statusColor(zone: LocalZone): string {
  if (!zone.enabled) return "grey";
  const status = zone.last_status;
  if (!status) return "grey";
  const s = status.toLowerCase();
  if (s.includes("ok") || s.includes("success")) return "success";
  if (s.includes("fail") || s.includes("error")) return "error";
  return "info";
}

function statusIcon(zone: LocalZone): string {
  if (!zone.enabled) return "mdi-cancel";
  const status = zone.last_status;
  if (!status) return "mdi-clock-outline";
  const s = status.toLowerCase();
  if (s.includes("ok") || s.includes("success")) return "mdi-check-circle";
  if (s.includes("fail") || s.includes("error")) return "mdi-alert-circle";
  return "mdi-information";
}

function statusLabel(zone: LocalZone): string {
  if (!zone.enabled) return "disabled";
  const status = zone.last_status;
  if (!status || !status.trim()) return "never run";
  // Backend embeds the record count (e.g. "ok: 3 records") — show just the status.
  return status.replace(/:.*$/, "").trim();
}

function formatInterval(seconds: number): string {
  if (seconds % 86400 === 0) return `every ${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `every ${seconds / 3600}h`;
  if (seconds % 60 === 0) return `every ${seconds / 60}m`;
  return `every ${seconds}s`;
}

function formatUpdated(ts: string | null): string {
  if (!ts) return "never";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- Loaded records (merged /local-records, filtered client-side) ----
// Zone-file record sets are small, so fetch all once and filter in memory; the
// type dropdown then reflects exactly the types present.
const RECORD_PAGE_SIZE = 25;

const recordHeaders = [
  { title: "Request", key: "name" },
  { title: "Type", key: "type" },
  { title: "Response", key: "value" },
  { title: "TTL", key: "ttl", align: "end" as const }
];

const records = ref<LocalRecord[]>([]);
const recordsLoading = ref(true);
const recordsError = ref<string | null>(null);
const search = ref("");
const typeFilter = ref("all");
const recordPage = ref(1);

async function loadRecords(): Promise<void> {
  recordsLoading.value = true;
  recordsError.value = null;
  try {
    const page = await listLocalRecords();
    records.value = page.items;
  } catch (e) {
    recordsError.value = apiErrorMessage(e);
    records.value = [];
  } finally {
    recordsLoading.value = false;
  }
}

const typeSelectOptions = computed(() => [
  { title: "All types", value: "all" },
  ...[...new Set(records.value.map((r) => r.type))]
    .sort((a, b) => a.localeCompare(b))
    .map((t) => ({ title: t, value: t }))
]);

const filteredRecords = computed(() => {
  const q = search.value.trim().toLowerCase();
  const t = typeFilter.value;
  return records.value.filter((r) => {
    if (t !== "all" && r.type.toLowerCase() !== t.toLowerCase()) return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.value.toLowerCase().includes(q)) return false;
    return true;
  });
});

const recordPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredRecords.value.length / RECORD_PAGE_SIZE))
);

// Jump back to the first page whenever the filters change the result set.
watch([search, typeFilter], () => {
  recordPage.value = 1;
});

onMounted(() => {
  void store.load();
  void loadSiteStats();
  void loadRecords();
});
</script>

<template>
  <div>
    <LocalTrafficChart
      :stats="siteStats"
      :loading="siteLoading"
      :error="siteError"
      class="mb-6"
    />

    <p class="text-caption text-medium-emphasis mb-4">
      Load DNS records from remote zone files (a GitHub page, a raw text file, etc.) straight into
      the resolver cache. Add the links to fetch, then review the records they loaded below.
    </p>

    <!-- Record sources (zones) -->
    <div class="d-flex align-center flex-wrap ga-3 mb-3">
      <div class="text-subtitle-1 font-weight-medium">
        Record sources
      </div>
      <v-chip
        size="small"
        variant="tonal"
        color="primary"
      >
        {{ total.toLocaleString() }}
      </v-chip>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="refreshingAll"
        :disabled="items.length === 0"
        @click="refreshAll"
      >
        Refresh all
      </v-btn>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New source
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
      empty-text="No record sources configured yet."
    >
      <v-card
        color="surface-card"
        class="mb-6"
      >
        <v-data-table
          :headers="zoneHeaders"
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
          <template #item.update_interval_seconds="{ item }">
            <span class="text-medium-emphasis">{{ formatInterval(item.update_interval_seconds) }}</span>
          </template>
          <template #item.record_count="{ item }">
            <span class="font-weight-medium">{{ item.record_count.toLocaleString() }}</span>
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
              :disabled="refreshingAll"
              title="Refresh now"
              @click="refresh(item)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              title="Delete source"
              @click="confirmDelete = item"
            />
          </template>
        </v-data-table>
      </v-card>
    </AsyncState>

    <!-- Loaded records (merged across zones) -->
    <div class="d-flex align-center flex-wrap ga-3 mb-1">
      <div class="text-subtitle-1 font-weight-medium">
        Loaded records
      </div>
      <v-chip
        size="small"
        variant="tonal"
        color="primary"
      >
        {{ records.length.toLocaleString() }}
      </v-chip>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="recordsLoading"
        @click="loadRecords"
      >
        Refresh
      </v-btn>
    </div>
    <p class="text-caption text-medium-emphasis mb-3">
      Every DNS record pulled in from the sources above — for troubleshooting what the resolver
      answers locally.
    </p>

    <div class="d-flex align-center flex-wrap ga-3 mb-3">
      <v-text-field
        v-model="search"
        label="Search name or value"
        density="compact"
        variant="outlined"
        hide-details
        prepend-inner-icon="mdi-magnify"
        class="record-search"
      />
      <v-select
        v-model="typeFilter"
        :items="typeSelectOptions"
        label="Type"
        density="compact"
        variant="outlined"
        hide-details
        class="type-filter"
      />
    </div>

    <AsyncState
      :loading="recordsLoading"
      :error="recordsError"
      :empty="records.length === 0"
      empty-text="No records loaded yet — add a source and refresh it."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="recordHeaders"
          :items="filteredRecords"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="RECORD_PAGE_SIZE"
          :page="recordPage"
          hide-default-footer
          no-data-text="No records match the current filters."
        >
          <template #item.type="{ item }">
            <v-chip
              size="small"
              variant="tonal"
            >
              {{ item.type }}
            </v-chip>
          </template>
          <template #item.value="{ item }">
            <span class="record-value">{{ item.value }}</span>
          </template>
        </v-data-table>
        <div
          v-if="recordPageCount > 1"
          class="d-flex justify-center pa-2"
        >
          <v-pagination
            :model-value="recordPage"
            :length="recordPageCount"
            :total-visible="7"
            @update:model-value="recordPage = $event"
          />
        </div>
      </v-card>
    </AsyncState>

    <!-- Create source dialog -->
    <v-dialog
      v-model="dialog"
      max-width="560"
    >
      <v-card>
        <v-card-title>New record source</v-card-title>
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
            autofocus
          />
          <v-select
            v-model="form.update_interval_seconds"
            :items="intervalOptions"
            label="Refresh interval"
          />
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

    <!-- Delete confirm -->
    <v-dialog
      :model-value="confirmDelete !== null"
      max-width="440"
      @update:model-value="confirmDelete = null"
    >
      <v-card>
        <v-card-title>Delete record source</v-card-title>
        <v-card-text>
          Delete this source (<strong>{{ confirmDelete?.url }}</strong>) and all records it loaded?
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
  </div>
</template>

<style scoped>
.source-url,
.record-value {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.85rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.record-search {
  max-width: 320px;
}

.type-filter {
  max-width: 200px;
}
</style>
