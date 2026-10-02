<script setup lang="ts">
import { ref } from "vue";
import { flushCache } from "@/services/cache";
import { apiErrorMessage } from "@/services/errors";

const flushing = ref(false);
const flushError = ref<string | null>(null);
const flushed = ref(false);

async function clearCache(): Promise<void> {
  flushing.value = true;
  flushError.value = null;
  flushed.value = false;
  try {
    await flushCache();
    flushed.value = true;
  } catch (e) {
    flushError.value = apiErrorMessage(e);
  } finally {
    flushing.value = false;
  }
}
</script>

<template>
  <v-card
    color="surface-card"
    max-width="640"
  >
    <v-card-text>
      <v-alert
        v-if="flushError"
        type="error"
        variant="tonal"
        class="mb-4"
      >
        {{ flushError }}
      </v-alert>
      <v-alert
        v-if="flushed"
        type="success"
        variant="tonal"
        class="mb-4"
      >
        Cache flush requested. The resolver clears its cache on its next refresh.
      </v-alert>

      <div class="text-subtitle-1 mb-1">
        DNS cache
      </div>
      <p class="text-medium-emphasis mb-4">
        Clear the resolver's in-memory DNS cache. The flush is applied by the DNS
        worker on its next poll, not immediately.
      </p>
      <v-btn
        color="primary"
        :loading="flushing"
        prepend-icon="mdi-cached"
        @click="clearCache"
      >
        Clear DNS Cache
      </v-btn>
    </v-card-text>
  </v-card>
</template>

