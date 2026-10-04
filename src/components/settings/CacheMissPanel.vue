<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { listUncacheable } from "@/services/cache";
import { getCacheOutcomes } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import CacheMissReasonsChart from "@/components/dashboard/CacheMissReasonsChart.vue";
import type { CacheMissReason, CacheOutcomeStat, UncacheableRow } from "@/types/domain";

const reasonLabels: Record<CacheMissReason, string> = {
  nxdomain: "NXDOMAIN",
  nodata: "No Data",
  "zero-ttl": "Zero TTL",
  error: "Error",
  "upstream-failure": "Upstream Failure"
};

const reasonColors: Record<CacheMissReason, string> = {
  nxdomain: "#ff5a36",
  nodata: "#ffc93c",
  "zero-ttl": "#4a90d9",
  error: "#f5822a",
  "upstream-failure": "#7b61ff"
};

// Server-side ?reason= filter options for the detail table ("all" clears it).
const reasonOptions: { title: string; value: CacheMissReason | "all" }[] = [
  { title: "All reasons", value: "all" },
  ...(Object.keys(reasonLabels) as CacheMissReason[]).map((key) => ({
    title: reasonLabels[key],
    value: key
  }))
];

const headers = [
  { title: "Client", key: "client" },
  { title: "Domain", key: "domain" },
  { title: "Type", key: "qtype" },
  { title: "Reason", key: "reason" },
  { title: "Last TTL", key: "last_ttl", align: "end" as const },
  { title: "Hits", key: "hits", align: "end" as const },
  { title: "First seen", key: "first_seen" },
  { title: "Last seen", key: "last_seen" }
];

// ---- Uncacheable detail table (GET /cache/uncacheable) ----
// Fetch the top rows and page client-side, 25 per page; re-fetch on reason change.
const UNCACHEABLE_LIMIT = 200;
const PAGE_SIZE = 25;

const rows = ref<UncacheableRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const reasonFilter = ref<CacheMissReason | "all">("all");
const page = ref(1);
const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / PAGE_SIZE)));

async function loadRows(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const reason = reasonFilter.value === "all" ? undefined : reasonFilter.value;
    const res = await listUncacheable(reason, UNCACHEABLE_LIMIT);
    rows.value = res.items;
    page.value = 1;
  } catch (e) {
    error.value = apiErrorMessage(e);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

// ---- Reasons chart (GET /stats/cache-outcomes) ----
const outcomes = ref<CacheOutcomeStat[]>([]);
const chartLoading = ref(true);
const chartError = ref<string | null>(null);

async function loadOutcomes(): Promise<void> {
  chartLoading.value = true;
  chartError.value = null;
  try {
    outcomes.value = await getCacheOutcomes(100);
  } catch (e) {
    chartError.value = apiErrorMessage(e);
    outcomes.value = [];
  } finally {
    chartLoading.value = false;
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
  void loadOutcomes();
  void loadRows();
});
</script>

<template>
  <div>
    <p class="text-caption text-medium-emphasis mb-4">
      Forwarded answers the resolver couldn't cache — why lookups keep missing the cache and which
      domains miss most often.
    </p>

    <CacheMissReasonsChart
      :stats="outcomes"
      :loading="chartLoading"
      :error="chartError"
      class="mb-6"
    />

    <div class="d-flex align-center flex-wrap ga-3 mb-3">
      <div class="text-subtitle-1 font-weight-medium">
        Uncacheable domains
      </div>
      <v-spacer />
      <v-select
        v-model="reasonFilter"
        :items="reasonOptions"
        label="Reason"
        density="compact"
        variant="outlined"
        hide-details
        class="reason-filter"
        @update:model-value="loadRows"
      />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="loadRows"
      >
        Refresh
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="rows.length === 0"
      empty-text="No uncacheable responses recorded."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="headers"
          :items="rows"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="PAGE_SIZE"
          :page="page"
          hide-default-footer
        >
          <template #item.reason="{ item }">
            <v-chip
              size="small"
              variant="tonal"
              :color="reasonColors[item.reason]"
            >
              {{ reasonLabels[item.reason] }}
            </v-chip>
          </template>
          <template #item.last_ttl="{ item }">
            {{ item.last_ttl ?? "—" }}
          </template>
          <template #item.hits="{ item }">
            {{ item.hits.toLocaleString() }}
          </template>
          <template #item.first_seen="{ item }">
            <span class="date-column">{{ formatDateTime(item.first_seen) }}</span>
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

<style scoped>
.reason-filter {
  max-width: 220px;
}
</style>
