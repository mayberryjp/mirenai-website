<script setup lang="ts">
// Renders the four required data states (spec / standards §11):
// loading, error, empty, success. Success content goes in the default slot.
withDefaults(
  defineProps<{
    loading: boolean;
    error: string | null;
    empty: boolean;
    emptyText?: string;
  }>(),
  { emptyText: "Nothing here yet." }
);
</script>

<template>
  <div
    v-if="loading"
    class="d-flex justify-center pa-8"
  >
    <v-progress-circular
      indeterminate
      color="primary"
      aria-label="Loading"
    />
  </div>

  <v-alert
    v-else-if="error"
    type="error"
    variant="tonal"
    class="my-4"
  >
    {{ error }}
  </v-alert>

  <div
    v-else-if="empty"
    class="text-medium-emphasis text-center pa-8"
  >
    <slot name="empty">
      {{ emptyText }}
    </slot>
  </div>

  <slot v-else />
</template>
