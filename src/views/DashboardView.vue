<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useClientsStore } from "@/stores/clients";
import { getRecentNewDomains, getRuntimeStats, getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import SiteTrafficChart from "@/components/dashboard/SiteTrafficChart.vue";
import RecentDomainsTable from "@/components/dashboard/RecentDomainsTable.vue";
import type { RecentNewDomain, RuntimeStats, SiteHourlyStat } from "@/types/domain";

const clients = useClientsStore();

const siteStats = ref<SiteHourlyStat[]>([]);
const siteLoading = ref(true);
const siteError = ref<string | null>(null);

const recentDomains = ref<RecentNewDomain[]>([]);
const recentLoading = ref(true);
const recentError = ref<string | null>(null);

const runtime = ref<RuntimeStats | null>(null);

// Aggregate the already-loaded 100-hour site stats (no extra API calls).
const siteTotals = computed(() =>
  siteStats.value.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.cached += s.cached;
      acc.blocked += s.blocked;
      acc.denied += s.denied;
      return acc;
    },
    { total: 0, cached: 0, blocked: 0, denied: 0 }
  )
);

// Top banner: current resolver runtime snapshot (GET /stats/runtime).
const stats = computed(() => [
  {
    label: "Cache Size",
    description: `of ${fmt(runtime.value?.cache_capacity ?? 0)}`,
    value: runtime.value?.cache_size ?? 0,
    color: "text-blue"
  },
  {
    label: "Blocklist Domains",
    description: "In Blocklist",
    value: runtime.value?.blocklist_domains ?? 0,
    color: "text-green"
  },
  {
    label: "Upstreams",
    description: "Resolvers",
    value: runtime.value?.upstreams ?? 0,
    color: "text-blue"
  },
  {
    label: "Policies",
    description: "Rules",
    value: runtime.value?.policies ?? 0,
    color: "text-green"
  }
]);

// Traffic totals moved into chips under the Site DNS Traffic header.
const trafficChips = computed(() => [
  { label: "Queries", value: siteTotals.value.total, color: "#2ec4a0" },
  { label: "Cached", value: siteTotals.value.cached, color: "#4a90d9" },
  { label: "Blocklist Denied", value: siteTotals.value.blocked, color: "#ff5a36" },
  { label: "Policy Denied", value: siteTotals.value.denied, color: "#f5822a" }
]);

function fmt(n: number): string {
  return n.toLocaleString();
}

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

async function loadRecentDomains(): Promise<void> {
  recentLoading.value = true;
  recentError.value = null;
  try {
    recentDomains.value = await getRecentNewDomains(100);
  } catch (e) {
    recentError.value = apiErrorMessage(e);
    recentDomains.value = [];
  } finally {
    recentLoading.value = false;
  }
}

async function loadRuntime(): Promise<void> {
  try {
    runtime.value = await getRuntimeStats();
  } catch {
    runtime.value = null;
  }
}

onMounted(() => {
  if (!clients.loaded) void clients.load();
  void loadSiteStats();
  void loadRecentDomains();
  void loadRuntime();
});
</script>

<template>
  <div>
    <!-- Quick stats banner -->
    <v-row class="quickstats-background ma-0 rounded-lg mb-4">
      <v-col
        v-for="(s, i) in stats"
        :key="i"
        cols="6"
        sm="4"
        md
        class="bg-transparent"
      >
        <v-card
          variant="plain"
          class="text-center pa-2 pa-sm-4 bg-transparent"
        >
          <div class="stat-label mb-1">
            {{ s.label }}
          </div>
          <div class="stat-description mb-1">
            {{ s.description }}
          </div>
          <div :class="['stat-value font-weight-bold', s.color]">
            {{ fmt(s.value) }}
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Site-wide DNS traffic (last 100 hours) -->
    <SiteTrafficChart
      :stats="siteStats"
      :loading="siteLoading"
      :error="siteError"
      :totals="trafficChips"
    />

    <!-- Recently first-seen client/domain pairs -->
    <RecentDomainsTable
      :rows="recentDomains"
      :loading="recentLoading"
      :error="recentError"
      class="mt-4"
    />
  </div>
</template>

<style scoped>
.quickstats-background {
  background-color: #0d1117 !important;
  color: rgba(255, 255, 255, 0.87);
  padding: 5px;
}

.stat-label {
  color: #b1b8c0;
  font-size: 1.25rem;
  font-weight: 500;
  font-family: var(--app-font-family);
}

.stat-description {
  font-size: 14px;
  color: #8b949e;
}

.stat-value {
  font-size: 2rem;
  line-height: 2.4rem;
}

.text-blue {
  color: #4a90d9 !important;
}

.text-green {
  color: #2ec4a0 !important;
}
</style>
