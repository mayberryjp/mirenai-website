<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useClientsStore } from "@/stores/clients";
import { useSettingsStore } from "@/stores/settings";
import { getClientStats } from "@/services/stats";
import { getClientMode, setClientMode } from "@/services/clients";
import { deleteHost, findHostByIp, syncHost } from "@/services/hosts";
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
  void loadStats();
  void loadMode();
});

// Re-fetch when navigating between clients without leaving the route.
watch(client, () => {
  syncError.value = null;
  deleteError.value = null;
  confirmDelete.value = false;
  void loadStats();
  void loadMode();
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
            </div>

            <!-- Compact client policy: Allow / Block -->
            <div class="client-policy mt-3">
              <div class="policy-label text-caption text-medium-emphasis mb-1">
                Response policy
              </div>
              <div class="d-flex align-center flex-wrap ga-2">
                <v-btn-toggle
                  :model-value="selectedMode"
                  density="compact"
                  divided
                  class="policy-toggle"
                >
                  <v-btn
                    value="forward"
                    size="small"
                    :disabled="modeSaving"
                    @click="onModeChange('forward')"
                  >
                    Allow
                  </v-btn>
                  <v-btn
                    value="deny"
                    size="small"
                    :disabled="modeSaving"
                    @click="onModeChange('deny')"
                  >
                    Block
                  </v-btn>
                </v-btn-toggle>
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
