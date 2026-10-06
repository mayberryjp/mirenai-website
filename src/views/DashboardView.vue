<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useClientsStore } from "@/stores/clients";
import { getRecentNewDomains, getRuntimeStats, getSiteStats } from "@/services/stats";
import { listLocalRecords, listLocalZones } from "@/services/localZones";
import { apiErrorMessage } from "@/services/errors";
import SiteTrafficChart from "@/components/dashboard/SiteTrafficChart.vue";
import RecentDomainsTable from "@/components/dashboard/RecentDomainsTable.vue";
import type { RecentNewDomain, RuntimeStats, SiteHourlyStat } from "@/types/domain";
import type { RouteLocationRaw } from "vue-router";

const clients = useClientsStore();

const siteStats = ref<SiteHourlyStat[]>([]);
const siteLoading = ref(true);
const siteError = ref<string | null>(null);

const recentDomains = ref<RecentNewDomain[]>([]);
const recentLoading = ref(true);
const recentError = ref<string | null>(null);

const runtime = ref<RuntimeStats | null>(null);

// Totals for the two Local Domains cubes (counts only, no table rendered here).
const localSources = ref(0);
const localRecords = ref(0);

// Aggregate the already-loaded 100-hour site stats (no extra API calls).
const siteTotals = computed(() =>
  siteStats.value.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.forwarded += s.forwarded;
      acc.cached += s.cached;
      acc.overridden += s.overridden;
      acc.denied += s.denied;
      acc.blocked += s.blocked;
      acc.servfail += s.servfail;
      acc.local += s.local;
      acc.foreign += s.foreign;
      return acc;
    },
    { total: 0, forwarded: 0, cached: 0, overridden: 0, denied: 0, blocked: 0, servfail: 0, local: 0, foreign: 0 }
  )
);

// Top banner: current resolver runtime snapshot (GET /stats/runtime).
// `to` turns a cube into a shortcut to the matching settings page.
interface StatCard {
  label: string;
  description: string;
  value: number;
  color: string;
  to?: RouteLocationRaw;
}

const stats = computed<StatCard[]>(() => [
  {
    label: "Cache Size",
    description: `of ${fmt(runtime.value?.cache_capacity ?? 0)}`,
    value: runtime.value?.cache_size ?? 0,
    color: "text-blue",
    to: { name: "settings-cache" }
  },
  {
    label: "Blocklist Domains",
    description: "In Blocklist",
    value: runtime.value?.blocklist_domains ?? 0,
    color: "text-green",
    to: { name: "settings-blocklists" }
  },
  {
    label: "Upstreams",
    description: "Resolvers",
    value: runtime.value?.upstreams ?? 0,
    color: "text-blue",
    to: { name: "settings-upstreams" }
  },
  {
    label: "Local Sources",
    description: "Zone files",
    value: localSources.value,
    color: "text-green",
    to: { name: "settings-local-domains" }
  },
  {
    label: "Local Records",
    description: "DNS records",
    value: localRecords.value,
    color: "text-blue",
    to: { name: "settings-local-domains" }
  }
]);

// One chip per chart series, each with its share of total queries.
// Labels and colors mirror the Site DNS Traffic legend.
const trafficChips = computed(() => {
  const t = siteTotals.value;
  const pct = (n: number): number => (t.total > 0 ? (n / t.total) * 100 : 0);
  return [
    { label: "Forwarded", value: t.forwarded, color: "#2ec4a0", percent: pct(t.forwarded) },
    { label: "Cached", value: t.cached, color: "#7b61ff", percent: pct(t.cached) },
    { label: "Spoofed", value: t.overridden, color: "#ffc93c", percent: pct(t.overridden) },
    { label: "Policy Denied", value: t.denied, color: "#f5822a", percent: pct(t.denied) },
    { label: "Blocklist Denied", value: t.blocked, color: "#ff5a36", percent: pct(t.blocked) },
    { label: "Servfail", value: t.servfail, color: "#9aa4b2", percent: pct(t.servfail) },
    { label: "Local", value: t.local, color: "#e056a0", percent: pct(t.local) },
    { label: "Foreign Network", value: t.foreign, color: "#4a90d9", percent: pct(t.foreign) }
  ];
});

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
    recentDomains.value = await getRecentNewDomains(500);
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

// listLocalZones(1) returns the full source count in `total` with a minimal
// payload; /local-records has no limit param, so fetch all and count.
async function loadLocalCounts(): Promise<void> {
  const [zones, records] = await Promise.allSettled([listLocalZones(1), listLocalRecords()]);
  localSources.value = zones.status === "fulfilled" ? zones.value.total : 0;
  localRecords.value = records.status === "fulfilled" ? records.value.total : 0;
}

onMounted(() => {
  if (!clients.loaded) void clients.load();
  void loadSiteStats();
  void loadRecentDomains();
  void loadRuntime();
  void loadLocalCounts();
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
          :to="s.to"
          class="text-center pa-2 pa-sm-4 bg-transparent"
          :class="{ 'stat-card--link': s.to }"
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
      show-foreign
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

/* Linked cubes act as shortcuts; brighten the label on hover to signal it. */
.stat-card--link {
  cursor: pointer;
}

.stat-card--link:hover .stat-label {
  color: #ffffff;
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
