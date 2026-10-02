<script setup lang="ts">
import type { PolicyAction } from "@/types/domain";

const props = defineProps<{
  modelValue: PolicyAction[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: PolicyAction[]];
}>();

// Toggle boxes, one per policy action; empty selection = no filter (show all).
const options: { value: PolicyAction; label: string; color: string }[] = [
  { value: "forward", label: "Allow", color: "success" },
  { value: "override", label: "Spoof", color: "warning" },
  { value: "deny", label: "Policy Denied", color: "error" },
  { value: "blocklist", label: "Blocklist Denied", color: "burgundy" }
];

function isSelected(value: PolicyAction): boolean {
  return props.modelValue.includes(value);
}

function onUpdate(value: unknown): void {
  emit("update:modelValue", Array.isArray(value) ? (value as PolicyAction[]) : []);
}
</script>

<template>
  <v-btn-toggle
    :model-value="modelValue"
    density="compact"
    variant="tonal"
    divided
    multiple
    class="action-filter"
    @update:model-value="onUpdate"
  >
    <v-btn
      v-for="opt in options"
      :key="opt.value"
      :value="opt.value"
      size="small"
      :color="isSelected(opt.value) ? opt.color : undefined"
    >
      {{ opt.label }}
    </v-btn>
  </v-btn-toggle>
</template>
