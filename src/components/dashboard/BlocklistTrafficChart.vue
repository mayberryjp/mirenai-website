<script setup lang="ts">
import { computed } from "vue";
import type { HourlyResultStat } from "@/types/domain";

const props = withDefaults(
  defineProps<{
    stats: HourlyResultStat[];
    loading: boolean;
    error: string | null;
    title?: string;
    result?: "blocked" | "overridden";
  }>(),
  { title: "Blocklist Denied Traffic", result: "blocked" }
);

const seriesLabel = computed(() => props.result === "overridden" ? "Spoofed" : "Blocklist Denied");

// Oldest → newest, capped at the last 100 hourly buckets.
const recent = computed(() =>
  [...props.stats].sort((a, b) => a.hour_start.localeCompare(b.hour_start)).slice(-100)
);
const hasData = computed(() => recent.value.length > 0);

const categories = computed(() => recent.value.map((s) => formatHour(s.hour_start)));

const series = computed(() => [
  { name: seriesLabel.value, type: "line", data: recent.value.map((s) => s[props.result]) }
]);

const chartOptions = computed(() => ({
  chart: {
    id: props.result === "overridden" ? "spoofed-traffic-chart" : "blocklist-traffic-chart",
    background: "#0d1117",
    toolbar: { show: false },
    animations: { enabled: true, easing: "easeinout", speed: 800 },
    zoom: { enabled: false }
  },
  colors: [props.result === "overridden" ? "#36c9a0" : "#ff5a36"],
  fill: { opacity: 1 },
  stroke: { curve: "smooth", width: 2 },
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
    title: {
      text: props.result === "overridden" ? "Spoofed / hour" : "Blocklist denials / hour",
      style: { color: "#4a90d9" }
    },
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
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 13)}:00`;
}
</script>

<template>
  <v-card
    color="surface-card"
    class="blocklist-traffic-card"
  >
    <v-card-title class="d-flex align-center px-4 py-3">
      <span class="text-h6 text-sm-h5 blocklist-traffic-title">{{ title }}</span>
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
        mdi-chart-line
      </v-icon>
      <div class="text-grey">
        No {{ result === "overridden" ? "spoofed" : "blocklist" }} activity in the last 100 hours.
      </div>
    </v-card-text>

    <div
      v-else
      class="chart-wrap"
    >
      <apexchart
        type="line"
        height="320"
        :options="chartOptions"
        :series="series"
      />
    </div>
  </v-card>
</template>

<style scoped>
.blocklist-traffic-card {
  overflow: hidden;
}

.blocklist-traffic-title {
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
