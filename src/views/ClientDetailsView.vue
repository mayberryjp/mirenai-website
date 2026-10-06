<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useClientsStore } from "@/stores/clients";
import { useSettingsStore } from "@/stores/settings";
import { getClientStats } from "@/services/stats";
import { getClientMode, setClientMode } from "@/services/clients";
import { deleteHost, findHostByIp, setHostBlocklistExclusion, setHostNewDomainMonitoring, syncHost } from "@/services/hosts";
import { apiErrorMessage } from "@/services/errors";
import SiteTrafficChart from "@/components/dashboard/SiteTrafficChart.vue";
import DeviceIcon from "@/components/base/DeviceIcon.vue";
import HostNameEditor from "@/components/client-details/HostNameEditor.vue";
import DomainPolicyTable from "@/components/client-details/DomainPolicyTable.vue";
import type { ClientMode, ClientStat, QueryLog, SettableClientMode } from "@/types/domain";

const route = useRoute();
const router = useRouter();
const store = useClientsStore();
const settingsStore = useSettingsStore();

const client = computed(() => route.params.client as string);

const stats = ref<ClientStat[]>([]);
const statsLoading = ref(true);
const statsError = ref<string | null>(null);

const clientMode = ref<ClientMode | null>(null);
const modeSaving = ref(false);
const modeError = ref<string | null>(null);

const hostId = ref<number | null>(null);
const excludedFromBlocklist = ref<boolean | null>(null);
const blocklistSaving = ref(false);
const blocklistError = ref<string | null>(null);

const newDomainMonitoring = ref<boolean | null>(null);
const monitoringSaving = ref(false);
const monitoringError = ref<string | null>(null);

const syncing = ref(false);
const syncError = ref<string | null>(null);

const confirmDelete = ref(false);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

const domainRows = computed<QueryLog[]>(() =>
  [...store.rowsFor(client.value)].sort((a, b) => b.count - a.count)
);

// Which toggle box to highlight: an explicit Allow/Block wins; anything else
// (a "default" client, an advanced override, or before the mode loads) falls
// back to the global default action so a box is always selected.
const selectedMode = computed<"forward" | "deny" | null>(() => {
  const mode = clientMode.value;
  if (mode === "forward") return "forward";
  if (mode === "deny" || mode === "blocklist") return "deny";
  return settingsStore.settings?.default_action ?? null;
});

async function loadStats(): Promise<void> {
  statsLoading.value = true;
  statsError.value = null;
  try {
    stats.value = await getClientStats(client.value, 100);
  } catch (e) {
    statsError.value = apiErrorMessage(e);
    stats.value = [];
  } finally {
    statsLoading.value = false;
  }
}

async function loadMode(): Promise<void> {
  modeError.value = null;
  try {
    clientMode.value = (await getClientMode(client.value)).mode;
  } catch (e) {
    modeError.value = apiErrorMessage(e);
  }
}

// Client-level policy is simplified to two choices: Allow (forward) or Block (deny).
async function onModeChange(next: SettableClientMode): Promise<void> {
  if (modeSaving.value || next === clientMode.value) return;
  const prev = clientMode.value;
  modeSaving.value = true;
  modeError.value = null;
  clientMode.value = next; // optimistic
  try {
    clientMode.value = (await setClientMode(client.value, next)).mode;
  } catch (e) {
    clientMode.value = prev;
    modeError.value = apiErrorMessage(e);
  } finally {
    modeSaving.value = false;
  }
}

// Load the host row for this client to seed the blocklist toggle (id + current flag).
async function loadHost(): Promise<void> {
  blocklistError.value = null;
  try {
    const host = await findHostByIp(client.value);
    hostId.value = host?.id ?? null;
    excludedFromBlocklist.value = host?.excluded_from_blocklist ?? null;
    newDomainMonitoring.value = host?.flag_new_domains ?? null;
  } catch (e) {
    blocklistError.value = apiErrorMessage(e);
  }
}

// Blocklist enforcement per client: false = included (blue), true = excluded (orange).
async function onBlocklistChange(next: boolean): Promise<void> {
  if (
    blocklistSaving.value ||
    hostId.value === null ||
    next === excludedFromBlocklist.value
  ) {
    return;
  }
  const prev = excludedFromBlocklist.value;
  blocklistSaving.value = true;
  blocklistError.value = null;
  excludedFromBlocklist.value = next; // optimistic
  try {
    const host = await setHostBlocklistExclusion(hostId.value, next);
    excludedFromBlocklist.value = host.excluded_from_blocklist;
  } catch (e) {
    excludedFromBlocklist.value = prev;
    blocklistError.value = apiErrorMessage(e);
  } finally {
    blocklistSaving.value = false;
  }
}

// New-domain monitoring per client: true = included (monitored), false = excluded.
async function onMonitoringChange(next: boolean): Promise<void> {
  if (
    monitoringSaving.value ||
    hostId.value === null ||
    next === newDomainMonitoring.value
  ) {
    return;
  }
  const prev = newDomainMonitoring.value;
  monitoringSaving.value = true;
  monitoringError.value = null;
  newDomainMonitoring.value = next; // optimistic
  try {
    const host = await setHostNewDomainMonitoring(hostId.value, next);
    newDomainMonitoring.value = host.flag_new_domains;
  } catch (e) {
    newDomainMonitoring.value = prev;
    monitoringError.value = apiErrorMessage(e);
  } finally {
    monitoringSaving.value = false;
  }
}

// Pull the latest host details (name, icon, etc.) from Sando, then hard-refresh
// so every component re-reads the updated host.
async function onSync(): Promise<void> {
  if (syncing.value) return;
  syncing.value = true;
  syncError.value = null;
  try {
    const host = await findHostByIp(client.value);
    if (!host) throw new Error("No host record for this client");
    await syncHost(host.id);
    window.location.reload();
  } catch (e) {
    syncError.value = apiErrorMessage(e);
    syncing.value = false;
  }
}

// Remove this host record, then return to the dashboard.
async function onDelete(): Promise<void> {
  if (deleting.value) return;
  deleting.value = true;
  deleteError.value = null;
  try {
    const host = await findHostByIp(client.value);
    if (!host) throw new Error("No host record for this client");
    await deleteHost(host.id);
    confirmDelete.value = false;
    await router.push({ name: "dashboard" });
  } catch (e) {
    deleteError.value = apiErrorMessage(e);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  if (!store.loaded) void store.load();
  if (!settingsStore.settings) void settingsStore.load();
  void store.loadClientRows(client.value);
  void loadStats();
  void loadMode();
  void loadHost();
});

// Re-fetch when navigating between clients without leaving the route.
watch(client, () => {
  syncError.value = null;
  deleteError.value = null;
  blocklistError.value = null;
  monitoringError.value = null;
  confirmDelete.value = false;
  void store.loadClientRows(client.value);
  void loadStats();
  void loadMode();
  void loadHost();
});
</script>

<template>
  <div class="client-details">
    <!-- Header -->
    <v-card
      color="surface-card"
      class="mb-4"
    >
      <v-card-text>
        <div class="d-flex flex-column flex-sm-row align-start align-sm-center">
          <!-- Device icon -->
          <div class="device-icon-container me-sm-4 mb-3 mb-sm-0">
            <DeviceIcon
              :icon="store.iconFor(client)"
              :size="96"
              color="primary"
              class="icon-with-background"
            />
          </div>

          <!-- Client info -->
          <div class="client-title">
            <HostNameEditor :client="client" />
            <div class="text-subtitle-1 text-green">
              IP Address: {{ client }}
              <span class="ms-4">MAC Address: {{ store.macFor(client) }}</span>
            </div>

            <!-- Compact client policy: response mode + blocklist opt-out -->
            <div class="client-policy mt-3">
              <div class="d-flex align-end flex-wrap ga-3">
                <!-- Response mode: Allow / Block -->
                <div class="policy-group">
                  <div class="policy-label text-caption text-medium-emphasis mb-1">
                    Response policy
                  </div>
                  <v-btn-toggle
                    :model-value="selectedMode"
                    density="compact"
                    variant="tonal"
                    divided
                    class="policy-toggle"
                  >
                    <v-btn
                      value="forward"
                      size="small"
                      :color="selectedMode === 'forward' ? 'success' : undefined"
                      :disabled="modeSaving"
                      @click="onModeChange('forward')"
                    >
                      Allow
                    </v-btn>
                    <v-btn
                      value="deny"
                      size="small"
                      :color="selectedMode === 'deny' ? 'error' : undefined"
                      :disabled="modeSaving"
                      @click="onModeChange('deny')"
                    >
                      Block
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <!-- Blocklist opt-in/out: Included (blue) = enforced, Excluded (orange) = bypass -->
                <div class="policy-group">
                  <div class="policy-label text-caption text-medium-emphasis mb-1">
                    Blocklist Enforced
                  </div>
                  <v-btn-toggle
                    :model-value="excludedFromBlocklist"
                    density="compact"
                    variant="tonal"
                    divided
                    class="policy-toggle"
                  >
                    <v-btn
                      :value="false"
                      size="small"
                      :color="excludedFromBlocklist === false ? 'info' : undefined"
                      :disabled="blocklistSaving || excludedFromBlocklist === null"
                      @click="onBlocklistChange(false)"
                    >
                      Included
                    </v-btn>
                    <v-btn
                      :value="true"
                      size="small"
                      :color="excludedFromBlocklist === true ? 'orange' : undefined"
                      :disabled="blocklistSaving || excludedFromBlocklist === null"
                      @click="onBlocklistChange(true)"
                    >
                      Excluded
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <!-- New-domain monitoring: Included = track this client's new domains, Excluded = ignore -->
                <div class="policy-group">
                  <div class="policy-label text-caption text-medium-emphasis mb-1">
                    New Domain Monitoring
                  </div>
                  <v-btn-toggle
                    :model-value="newDomainMonitoring"
                    density="compact"
                    variant="tonal"
                    divided
                    class="policy-toggle"
                  >
                    <v-btn
                      :value="true"
                      size="small"
                      :color="newDomainMonitoring === true ? 'info' : undefined"
                      :disabled="monitoringSaving || newDomainMonitoring === null"
                      @click="onMonitoringChange(true)"
                    >
                      Included
                    </v-btn>
                    <v-btn
                      :value="false"
                      size="small"
                      :color="newDomainMonitoring === false ? 'orange' : undefined"
                      :disabled="monitoringSaving || newDomainMonitoring === null"
                      @click="onMonitoringChange(false)"
                    >
                      Excluded
                    </v-btn>
                  </v-btn-toggle>
                </div>

                <v-btn
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-sync"
                  :loading="syncing"
                  @click="onSync"
                >
                  SYNC DEVICE FROM SANDO
                </v-btn>
                <v-btn
                  variant="text"
                  size="small"
                  color="error"
                  prepend-icon="mdi-delete"
                  @click="confirmDelete = true"
                >
                  Delete Host
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <v-alert
          v-if="modeError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3 mb-0"
          closable
          @click:close="modeError = null"
        >
          {{ modeError }}
        </v-alert>

        <v-alert
          v-if="blocklistError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3 mb-0"
          closable
          @click:close="blocklistError = null"
        >
          {{ blocklistError }}
        </v-alert>

        <v-alert
          v-if="monitoringError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3 mb-0"
          closable
          @click:close="monitoringError = null"
        >
          {{ monitoringError }}
        </v-alert>

        <v-alert
          v-if="syncError"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3 mb-0"
          closable
          @click:close="syncError = null"
        >
          {{ syncError }}
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Last 100 hours of DNS queries (same layout as the dashboard chart) -->
    <div class="mb-4">
      <SiteTrafficChart
        title="DNS Traffic"
        :stats="stats"
        :loading="statsLoading"
        :error="statsError"
      />
    </div>

    <!-- Per-domain queries + policy override -->
    <DomainPolicyTable
      :client="client"
      :rows="domainRows"
      :client-mode="clientMode"
    />

    <v-dialog
      v-model="confirmDelete"
      max-width="420"
    >
      <v-card>
        <v-card-title>Delete host</v-card-title>
        <v-card-text>
          Delete the host record for <strong>{{ client }}</strong>? This removes its
          saved device name and details. This cannot be undone.
        </v-card-text>
        <v-alert
          v-if="deleteError"
          type="error"
          variant="tonal"
          density="compact"
          class="mx-4 mb-2"
          closable
          @click:close="deleteError = null"
        >
          {{ deleteError }}
        </v-alert>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmDelete = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="onDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.client-details {
  animation: fadeIn 0.3s ease-in-out;
}

.text-subtitle-1 {
  color: rgb(92, 221, 139) !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  margin-top: 3px;
  word-break: break-word;
}

.device-icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 120px;
  position: relative;
}

.client-title {
  flex: 1;
}

.client-policy {
  min-width: 150px;
}

/* Give the toggles and the action buttons one height so the row lines up cleanly. */
.client-policy :deep(.v-btn),
.client-policy :deep(.policy-toggle) {
  height: 36px;
}

.policy-label {
  text-align: start;
}

.icon-with-background {
  opacity: 0.9;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
