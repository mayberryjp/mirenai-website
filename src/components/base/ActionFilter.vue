<script setup lang="ts">
import { computed } from "vue";
import { ACTION_COLORS, loggedActionColor, loggedActionLabel } from "@/constants/actions";
import type { LoggedAction } from "@/types/domain";

const props = withDefaults(
  defineProps<{
    modelValue: LoggedAction[];
    // true = filter on the resolver's recorded response (last_action) instead of the policy
    logged?: boolean;
  }>(),
  { logged: false }
);

const emit = defineEmits<{
  "update:modelValue": [value: LoggedAction[]];
}>();

type Option = { value: LoggedAction; label: string; color: string };

// Toggle boxes, one per policy action; empty selection = no filter (show all).
const policyOptions: Option[] = [
  { value: "forward", label: "Allow", color: "success" },
  { value: "override", label: "Spoof", color: ACTION_COLORS.override },
  { value: "deny", label: "Policy Denied", color: ACTION_COLORS.deny },
  { value: "blocklist", label: "Blocklist Denied", color: ACTION_COLORS.blocklist }
];

const loggedOptions: Option[] = (
  ["forward", "forward-cache", "override", "deny", "blocklist", "nodata", "local", "servfail"] as const
).map((value) => ({
  value,
  label: loggedActionLabel(value),
  color: loggedActionColor(value)
}));

const options = computed(() => (props.logged ? loggedOptions : policyOptions));

function onUpdate(value: unknown): void {
  emit("update:modelValue", Array.isArray(value) ? (value as LoggedAction[]) : []);
}
</script>

<template>
  <v-select
    :model-value="modelValue"
    :items="options"
    item-title="label"
    item-value="value"
    multiple
    clearable
    chips
    closable-chips
    density="compact"
    variant="outlined"
    hide-details
    placeholder="Filter by action"
    class="action-filter"
    @update:model-value="onUpdate"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps">
        <template #prepend>
          <span
            class="action-dot"
            :style="{ background: item.raw.color }"
          />
        </template>
      </v-list-item>
    </template>
    <template #chip="{ props: chipProps, item }">
      <v-chip
        v-bind="chipProps"
        size="small"
        variant="tonal"
        :color="item.raw.color"
      />
    </template>
  </v-select>
</template>

<style scoped>
.action-filter {
  min-width: 220px;
  max-width: 340px;
}

.action-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 12px;
  border-radius: 50%;
}
</style>
