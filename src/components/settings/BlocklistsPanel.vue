<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useBlocklistsStore } from "@/stores/blocklists";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import type { Blocklist, BlocklistCreate } from "@/types/domain";

const store = useBlocklistsStore();
const { items, loading, error, refreshingId } = storeToRefs(store);

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

onMounted(() => {
  void store.load();
});
</script>

<template>
  <div>
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
  </div>
</template>

<style scoped>
.source-url {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.85rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
