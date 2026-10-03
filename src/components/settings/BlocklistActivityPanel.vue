<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listTopBlocked } from "@/services/queries";
import { getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import { useClientsStore } from "@/stores/clients";
import AsyncState from "@/components/base/AsyncState.vue";
import BlocklistTrafficChart from "@/components/dashboard/BlocklistTrafficChart.vue";
import type { SiteHourlyStat, TopBlockedDomain } from "@/types/domain";

// Resolves client IPs to device names (falls back to the IP) in the clients column.
const clientsStore = useClientsStore();

// Read-only view of the most-blocked domains (GET /queries/top-blocked). Fetch
// the top 50 and page through them client-side, 25 per page.
const TOP_BLOCKED_LIMIT = 50;
const TOP_BLOCKED_PAGE_SIZE = 25;

const headers = [
  { title: "Domain", key: "domain" },
  { title: "Count", key: "count" },
  { title: "Clients", key: "clients", sortable: false },
  { title: "Blocklists", key: "blocklists", sortable: false },
  { title: "Last seen", key: "last_seen" }
];

const domains = ref<TopBlockedDomain[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const page = ref(1);
const pageCount = computed(() =>
  Math.max(1, Math.ceil(domains.value.length / TOP_BLOCKED_PAGE_SIZE))
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await listTopBlocked(TOP_BLOCKED_LIMIT);
    domains.value = res.items;
    page.value = 1;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

// Last 100 hours of blocklist-denied traffic for the chart at the top of the page.
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

// Datetimes arrive without an offset (container-local); render that same local
// wall-clock, matching the dashboard tables (no timezone conversion).
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
  void load();
  void loadSiteStats();
  if (!clientsStore.loaded) void clientsStore.load();
});
</script>

<template>
  <div>
    <BlocklistTrafficChart
      :stats="siteStats"
      :loading="siteLoading"
      :error="siteError"
      class="mb-4"
    />

    <div class="d-flex align-center mb-4 ga-3">
      <div class="text-body-2 text-medium-emphasis">
        The most-blocked domains across all clients, ranked by blocked query count.
      </div>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        Refresh
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="domains.length === 0"
      empty-text="No blocked queries recorded yet."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="headers"
          :items="domains"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="TOP_BLOCKED_PAGE_SIZE"
          :page="page"
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
                :title="c.client"
              >
                {{ clientsStore.nameFor(c.client) }} ({{ c.count.toLocaleString() }})
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
          <template #item.last_seen="{ item }">
            <span class="date-column">{{ formatDateTime(item.last_seen) }}</span>
          </template>
        </v-data-table>
        <div
          v-if="pageCount > 1"
          class="d-flex justify-center pa-2"
        >
          <v-pagination
            :model-value="page"
            :length="pageCount"
            :total-visible="7"
            @update:model-value="page = $event"
          />
        </div>
      </v-card>
    </AsyncState>
  </div>
</template>
