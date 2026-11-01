<script setup lang="ts">
import { onMounted, ref } from "vue";
import PolicyControl from "@/components/base/PolicyControl.vue";
import BlocklistTrafficChart from "@/components/dashboard/BlocklistTrafficChart.vue";
import { loggedActionColor, loggedActionLabel } from "@/constants/actions";
import { apiErrorMessage } from "@/services/errors";
import { listTopPolicyDenied } from "@/services/queries";
import { getSiteStats } from "@/services/stats";
import { useClientsStore } from "@/stores/clients";
import { usePoliciesStore } from "@/stores/policies";
import type { SiteHourlyStat, TopPolicyDeniedDomain } from "@/types/domain";

const clients = useClientsStore();
const policies = usePoliciesStore();
const stats = ref<SiteHourlyStat[]>([]);
const statsLoading = ref(false);
const statsError = ref<string | null>(null);
const items = ref<TopPolicyDeniedDomain[]>([]);
const TOP_DENIED_LIMIT = 100;
const page = ref(1);
const perPage = ref(25);
const loading = ref(false);
const error = ref<string | null>(null);
let requestId = 0;
let trafficRequestId = 0;

const headers = [
  { title: "Clients", key: "clients", sortable: false },
  { title: "Domain", key: "domain", sortable: false },
  { title: "Count", key: "count", sortable: false },
  { title: "First Seen", key: "first_seen", sortable: false },
  { title: "Last Seen", key: "last_seen", sortable: false },
  { title: "Action Taken", key: "action", sortable: false },
  { title: "Response Policy", key: "policy", sortable: false }
];

// Render raw wall-clock parts, without Date parsing or timezone conversion.
function formatDateTime(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  return parts ? `${parts[2]}/${parts[3]} ${parts[4]}:${parts[5]}` : value;
}

async function loadRows(): Promise<void> {
  const currentRequest = ++requestId;
  loading.value = true;
  error.value = null;
  try {
    const result = await listTopPolicyDenied(TOP_DENIED_LIMIT);
    if (currentRequest !== requestId) return;
    items.value = result.items;
    page.value = Math.min(page.value, Math.max(1, Math.ceil(result.items.length / perPage.value)));
  } catch (cause) {
    if (currentRequest === requestId) error.value = apiErrorMessage(cause);
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

async function loadTraffic(): Promise<void> {
  const currentRequest = ++trafficRequestId;
  statsLoading.value = true;
  statsError.value = null;
  try {
    const result = await getSiteStats(100);
    if (currentRequest === trafficRequestId) stats.value = result;
  } catch (cause) {
    if (currentRequest === trafficRequestId) statsError.value = apiErrorMessage(cause);
  } finally {
    if (currentRequest === trafficRequestId) statsLoading.value = false;
  }
}

function refresh(): void {
  void loadRows();
  void loadTraffic();
  void policies.load();
  if (!clients.loaded || clients.error) void clients.load();
}

onMounted(refresh);
</script>

<template>
  <div>
    <BlocklistTrafficChart
      :stats="stats"
      :loading="statsLoading"
      :error="statsError"
      title="Policy Denied Traffic"
      result="denied"
      class="mb-4"
    />

    <div class="d-flex align-center ga-3 mb-4">
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading || statsLoading || policies.loading"
        @click="refresh"
      >
        Refresh
      </v-btn>
    </div>

    <v-sheet
      rounded="lg"
      color="#090c10"
    >
      <v-card-title class="text-h6 text-sm-h5 text-md-h4 table-title">
        Top Policy Denied Requests
      </v-card-title>
      <v-alert
        v-if="clients.error"
        type="error"
        variant="tonal"
        class="ma-3"
      >
        Client names could not be loaded: {{ clients.error }}
      </v-alert>
      <v-alert
        v-if="policies.error"
        type="error"
        variant="tonal"
        class="ma-3"
      >
        Response policies could not be loaded: {{ policies.error }}
      </v-alert>
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        class="ma-3"
      >
        {{ error }}
      </v-alert>
      <v-data-table
        v-else
        :headers="headers"
        :items="items"
        :loading="loading"
        item-value="domain"
        :page="page"
        :items-per-page="perPage"
        :items-per-page-options="[10, 25, 50, 100]"
        density="compact"
        class="app-table"
        mobile-breakpoint="md"
        no-data-text="No policy-denied queries recorded yet."
        @update:page="page = $event"
        @update:items-per-page="perPage = $event; page = 1"
      >
        <template #item.clients="{ item }">
          <div
            v-for="client in item.clients"
            :key="client.client"
            class="text-no-wrap py-1"
          >
            <router-link
              :to="{ name: 'client', params: { client: client.client } }"
              :title="client.client"
            >
              {{ clients.nameFor(client.client) }}
            </router-link>
            ({{ client.count.toLocaleString() }})
          </div>
        </template>
        <template #item.count="{ item }">
          {{ item.count.toLocaleString() }}
        </template>
        <template #item.first_seen="{ item }">
          <span class="date-column text-no-wrap">{{ formatDateTime(item.first_seen) }}</span>
        </template>
        <template #item.last_seen="{ item }">
          <span class="date-column text-no-wrap">{{ formatDateTime(item.last_seen) }}</span>
        </template>
        <template #item.action>
          <v-chip
            size="small"
            variant="tonal"
            :color="loggedActionColor('deny')"
          >
            {{ loggedActionLabel("deny") }}
          </v-chip>
        </template>
        <template #item.policy="{ item }">
          <div
            v-if="!policies.loading && !policies.error"
          >
            <div
              v-for="client in item.clients"
              :key="client.client"
              class="py-1"
            >
              <span
                v-if="item.clients.length > 1"
                class="text-caption text-medium-emphasis"
              >{{ clients.nameFor(client.client) }}</span>
              <PolicyControl
                :client="client.client"
                :domain="item.domain"
              />
            </div>
          </div>
          <span
            v-else
            class="text-caption text-medium-emphasis"
          >
            {{ policies.loading ? "Loading policies..." : "Policies unavailable" }}
          </span>
        </template>
      </v-data-table>
    </v-sheet>
  </div>
</template>

<style scoped>
.table-title {
  color: #b1b8c0;
}
</style>
