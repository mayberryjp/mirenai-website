<script setup lang="ts">
import { computed } from "vue";
import type { CacheMissReason, CacheOutcomeStat } from "@/types/domain";

const props = withDefaults(
  defineProps<{
    stats: CacheOutcomeStat[];
    loading: boolean;
    error: string | null;
    title?: string;
  }>(),
  { title: "Cache Miss Reasons" }
);

// Only the five miss buckets are plotted; "cached" is the good outcome and would
// dwarf the misses, so it's excluded from this breakdown. Order = stacking order.
const MISS_REASONS: { key: CacheMissReason; label: string; color: string }[] = [
  { key: "nxdomain", label: "NXDOMAIN", color: "#ff5a36" },
  { key: "nodata", label: "No Data", color: "#ffc93c" },
  { key: "zero-ttl", label: "Zero TTL", color: "#4a90d9" },
  { key: "error", label: "Error", color: "#f5822a" },
  { key: "upstream-failure", label: "Upstream Failure", color: "#7b61ff" }
];

// Distinct hour buckets, oldest → newest, capped at the last 100.
const hours = computed(() => {
  const set = new Set(props.stats.map((s) => s.hour_start));
  return [...set].sort((a, b) => a.localeCompare(b)).slice(-100);
});
const hasData = computed(() => hours.value.length > 0);

// (hour, reason) → hits, for dense per-hour lookups.
const hitsByKey = computed(() => {
  const m = new Map<string, number>();
  for (const s of props.stats) m.set(`${s.hour_start}|${s.reason}`, s.hits);
  return m;
});

const categories = computed(() => hours.value.map((h) => formatHour(h)));

const series = computed(() =>
  MISS_REASONS.map((r) => ({
    name: r.label,
    data: hours.value.map((h) => hitsByKey.value.get(`${h}|${r.key}`) ?? 0)
  }))
);

const chartOptions = computed(() => ({
  chart: {
    id: "cache-miss-reasons-chart",
    stacked: true,
    background: "#0d1117",
    toolbar: { show: false },
    animations: { enabled: true, easing: "easeinout", speed: 800 },
    zoom: { enabled: false }
  },
  colors: MISS_REASONS.map((r) => r.color),
  fill: { opacity: 0.85 },
  stroke: { curve: "smooth", width: 1 },
  dataLabels: { enabled: false },
  tooltip: {
    theme: "dark",
    shared: true,
    y: { formatter: (val: number) => Math.round(val).toLocaleString() }
  },
  grid: {
    borderColor: "#333",
    row: { colors: ["transparent", "transparent"], opacity: 0.1 }
  },
  xaxis: {
    categories: categories.value,
    labels: { rotate: -45, style: { colors: "#b1b8c0" } },
    axisBorder: { color: "#333" },
    axisTicks: { color: "#333" }
  },
  yaxis: {
    title: { text: "Uncacheable / hour", style: { color: "#4a90d9" } },
    labels: {
      style: { colors: "#b1b8c0" },
      formatter: (val: number) => Math.round(val).toLocaleString()
    }
  },
  legend: {
    show: true,
    position: "top",
    horizontalAlign: "right",
    labels: { colors: "#b1b8c0" }
  },
  responsive: [
    {
      breakpoint: 600,
      options: {
        chart: { height: 280 },
        legend: { position: "bottom", horizontalAlign: "center" },
        xaxis: { labels: { show: false } }
      }
    }
  ]
}));

function formatHour(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:00`;
}
</script>

<template>
  <v-card
    color="surface-card"
    class="cache-miss-card"
  >
    <v-card-title class="d-flex align-center px-4 py-3">
      <span class="text-h6 text-sm-h5 cache-miss-title">{{ title }}</span>
      <v-spacer />
      <span class="text-caption text-grey">Last 100 hours</span>
    </v-card-title>

    <v-divider />

    <div
      v-if="loading"
      class="chart-state"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <v-card-text
      v-else-if="error"
      class="chart-state text-center"
    >
      <v-icon
        color="warning"
        size="28"
        class="mb-2"
      >
        mdi-alert-circle-outline
      </v-icon>
      <div class="text-grey">
        {{ error }}
      </div>
    </v-card-text>

    <v-card-text
      v-else-if="!hasData"
      class="chart-state text-center"
    >
      <v-icon
        color="grey"
        size="28"
        class="mb-2"
      >
        mdi-chart-areaspline
      </v-icon>
      <div class="text-grey">
        No uncacheable responses in the last 100 hours.
      </div>
    </v-card-text>

    <div
      v-else
      class="chart-wrap"
    >
      <apexchart
        type="area"
        height="320"
        :options="chartOptions"
        :series="series"
      />
    </div>
  </v-card>
</template>

<style scoped>
.cache-miss-card {
  overflow: hidden;
}

.cache-miss-title {
  font-family: var(--app-font-family);
  color: #ffffff;
}

.chart-wrap {
  padding: 12px 12px 4px;
}

.chart-state {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

:deep(.apexcharts-tooltip) {
  background: #1e1e1e !important;
  border: none !important;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4) !important;
}

:deep(.apexcharts-tooltip-title) {
  background: #2d2d2d !important;
  border-bottom: 1px solid #3a3a3a !important;
}
</style>
