<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useClientsStore } from "@/stores/clients";
import { usePoliciesStore } from "@/stores/policies";
import { useUpstreamsStore } from "@/stores/upstreams";
import { useBlocklistsStore } from "@/stores/blocklists";
import { getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import SiteTrafficChart from "@/components/dashboard/SiteTrafficChart.vue";
import type { SiteHourlyStat } from "@/types/domain";

const clients = useClientsStore();
const policies = usePoliciesStore();
const upstreams = useUpstreamsStore();
const blocklists = useBlocklistsStore();

const stats = computed(() => [
  { label: "Clients", description: "Seen", value: clients.total, color: "text-blue" },
  { label: "Queries", description: "Logged", value: clients.totalQueries, color: "text-green" },
  { label: "Policies", description: "Total", value: policies.total, color: "text-blue" },
  { label: "Upstreams", description: "Total", value: upstreams.total, color: "text-blue" },
  { label: "Blocklists", description: "Total", value: blocklists.total, color: "text-green" }
]);

function fmt(n: number): string {
  return n.toLocaleString();
}

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

onMounted(() => {
  if (!clients.loaded) void clients.load();
  void policies.load();
  void upstreams.load();
  void blocklists.load();
  void loadSiteStats();
});
</script>

<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-4">
      Dashboard
    </h1>

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
