<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useUpstreamsStore } from "@/stores/upstreams";
import { checkUpstream } from "@/services/upstreams";
import { getUpstreamRttStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import UpstreamRttChart from "@/components/dashboard/UpstreamRttChart.vue";
import type { Upstream, UpstreamCreate, UpstreamProtocol, UpstreamRttStat } from "@/types/domain";

const store = useUpstreamsStore();
const { items, loading, error } = storeToRefs(store);

const headers = [
  { title: "Priority", key: "priority" },
  { title: "Address", key: "address" },
  { title: "Port", key: "port" },
  { title: "Enabled", key: "enabled" },
  { title: "RTT", key: "rtt", sortable: false, align: "end" as const },
  { title: "Actions", key: "actions", sortable: false, align: "end" as const }
];

interface UpstreamForm {
  address: string;
  port: number;
  protocol: UpstreamProtocol;
  use_tls: boolean;
  tls_server_name: string;
  enabled: boolean;
  priority: number;
}

function emptyForm(): UpstreamForm {
  return {
    address: "", port: 53, protocol: "udp", use_tls: false,
    tls_server_name: "", enabled: true, priority: 100
  };
}

const dialog = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<UpstreamForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

function openEdit(row: Upstream): void {
  editingId.value = row.id;
  Object.assign(form, {
    address: row.address,
    port: row.port,
    protocol: row.protocol,
    use_tls: row.use_tls ?? false,
    tls_server_name: row.tls_server_name ?? "",
    enabled: row.enabled,
    priority: row.priority
  });
  formError.value = null;
  dialog.value = true;
}

function updateTls(enabled: boolean | null): void {
  form.use_tls = enabled === true;
  if (form.port === (form.use_tls ? 53 : 853)) {
    form.port = form.use_tls ? 853 : 53;
  }
}

async function submit(): Promise<void> {
  formError.value = null;
  if (form.use_tls && !form.tls_server_name.trim()) {
    formError.value = "TLS server name is required when DNS over TLS is enabled.";
    return;
  }
  saving.value = true;
  const body: UpstreamCreate = {
    address: form.address.trim(),
    port: form.port,
    protocol: form.protocol,
    use_tls: form.use_tls,
    tls_server_name: form.use_tls ? form.tls_server_name.trim() : null,
    enabled: form.enabled,
    priority: form.priority
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

const confirmDelete = ref<Upstream | null>(null);
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

interface RttState {
  loading: boolean;
  ms: number | null;
  error: string | null;
}
const rttState = reactive<Record<number, RttState>>({});

function rttLoading(id: number): boolean {
  return rttState[id]?.loading ?? false;
}

function rttLabel(id: number): string {
  const ms = rttState[id]?.ms;
  return ms == null ? "" : `${ms.toFixed(1)} ms`;
}

function rttError(id: number): string | null {
  return rttState[id]?.error ?? null;
}

async function checkRtt(row: Upstream): Promise<void> {
  rttState[row.id] = { loading: true, ms: null, error: null };
  try {
    const ms = await checkUpstream(row.id);
    rttState[row.id] = { loading: false, ms, error: null };
  } catch (e) {
    rttState[row.id] = { loading: false, ms: null, error: apiErrorMessage(e) };
  }
}

// Historical per-upstream RTT series for the chart (separate from the per-row
// on-demand "Check RTT" probe above).
const rttChartStats = ref<UpstreamRttStat[]>([]);
const rttChartLoading = ref(true);
const rttChartError = ref<string | null>(null);

async function loadRttChart(): Promise<void> {
  rttChartLoading.value = true;
  rttChartError.value = null;
  try {
    rttChartStats.value = await getUpstreamRttStats(100);
  } catch (e) {
    rttChartError.value = apiErrorMessage(e);
    rttChartStats.value = [];
  } finally {
    rttChartLoading.value = false;
  }
}

onMounted(() => {
  void store.load();
  void loadRttChart();
});
</script>

<template>
  <div>
    <UpstreamRttChart
      :stats="rttChartStats"
      :loading="rttChartLoading"
      :error="rttChartError"
      class="mb-4"
    />

    <div class="d-flex align-center mb-4">
      <span class="text-medium-emphasis text-body-2">Equal priority upstreams will be load balanced.</span>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New Upstream DNS Server
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No upstream resolvers."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="headers"
          :items="items"
          density="compact"
          class="app-table"
          mobile-breakpoint="md"
        >
          <template #item.address="{ item }">
            {{ item.address }}
            <v-chip
              v-if="item.use_tls"
              size="small"
              color="primary"
              variant="tonal"
              class="ml-2"
            >
              TLS
            </v-chip>
          </template>
          <template #item.enabled="{ item }">
            <v-chip
              :color="item.enabled ? 'success' : 'error'"
              size="small"
              variant="tonal"
            >
              {{ item.enabled ? "yes" : "no" }}
            </v-chip>
          </template>
          <template #item.rtt="{ item }">
            <div class="d-flex align-center justify-end ga-2">
              <span
                v-if="rttLabel(item.id)"
                class="rtt-value"
              >
                {{ rttLabel(item.id) }}
              </span>
              <v-tooltip
                v-else-if="rttError(item.id)"
                :text="rttError(item.id) ?? ''"
                location="top"
              >
                <template #activator="{ props }">
                  <v-icon
                    v-bind="props"
                    color="error"
                    size="small"
                  >
                    mdi-alert-circle-outline
                  </v-icon>
                </template>
              </v-tooltip>
              <v-btn
                :loading="rttLoading(item.id)"
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-speedometer"
                @click="checkRtt(item)"
              >
                Check RTT
              </v-btn>
            </div>
          </template>
          <template #item.actions="{ item }">
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
      </v-card>
    </AsyncState>

    <v-dialog
      v-model="dialog"
      max-width="560"
    >
      <v-card>
        <v-card-title>{{ editingId === null ? "New upstream" : "Edit upstream" }}</v-card-title>
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
            v-model="form.address"
            label="Address (IP)"
          />
          <v-text-field
            v-model.number="form.port"
            type="number"
            label="Port"
            :hint="form.use_tls ? 'DNS over TLS normally uses port 853.' : 'Plain DNS normally uses port 53.'"
            persistent-hint
          />
          <v-switch
            :model-value="form.use_tls"
            label="DNS over TLS"
            color="primary"
            @update:model-value="updateTls"
          />
          <v-text-field
            v-if="form.use_tls"
            v-model="form.tls_server_name"
            label="TLS server name (required)"
            placeholder="cloudflare-dns.com"
            hint="Certificate and hostname verification is required. TLS never falls back to plain DNS."
            persistent-hint
          />
          <v-text-field
            v-model.number="form.priority"
            type="number"
            label="Priority (lower = first)"
          />
          <v-switch
            v-model="form.enabled"
            label="Enabled"
            color="primary"
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

    <v-dialog
      :model-value="confirmDelete !== null"
      max-width="420"
      @update:model-value="confirmDelete = null"
    >
      <v-card>
        <v-card-title>Delete upstream</v-card-title>
        <v-card-text>
          Delete upstream <strong>{{ confirmDelete?.address }}</strong>?
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
.rtt-value {
  color: #b1b8c0;
  font-weight: 500;
  white-space: nowrap;
}
</style>
