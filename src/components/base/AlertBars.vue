<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    // One count per time interval (hour); each bar is coloured by severity.
    alertIntervals?: number[];
    height?: number;
    width?: number;
  }>(),
  { alertIntervals: () => [], height: 16, width: 5 }
);

// Reserve room for every bar at full width so they aren't squeezed thin (e.g. in
// the sidebar). Each bar = width + 2px gap + 2px margins.
const containerMinWidth = computed(
  () => props.alertIntervals.length * (props.width + 4)
);

function getAlertClass(alertCount: number): string {
  if (alertCount === 0) return "alert-none";
  if (alertCount <= 1) return "alert-low";
  if (alertCount <= 5) return "alert-medium";
  if (alertCount <= 20) return "alert-high";
  return "alert-critical";
}
</script>

<template>
  <div
    class="alert-bars"
    :style="{ width: `min(${containerMinWidth}px, 100%)` }"
  >
    <div
      v-for="(count, index) in alertIntervals"
      :key="index"
      class="alert-bar"
      :class="getAlertClass(count)"
      :style="{ maxWidth: `${width}px`, height: `${height}px` }"
      :title="`${count} alerts`"
    />
  </div>
</template>

<style scoped>
.alert-bars {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  align-items: center;
  overflow: hidden;
}

.alert-bar {
  /* Share container width equally so all bars show (no scroll), capped at width */
  flex: 1 1 0;
  min-width: 2px;
  margin: 1px;
  border-radius: 50rem;
  box-sizing: border-box;
  transition: transform 0.2s ease;
}

.alert-none {
  background-color: #2a2f35;
}

.alert-low {
  background-color: #64b5f6;
}

.alert-medium {
  background-color: #f5a623;
}

.alert-high {
  background-color: #1565c0;
}

.alert-critical {
  background-color: #f5a623;
}

.alert-bar:hover {
  transform: scale(1.5);
}
</style>
