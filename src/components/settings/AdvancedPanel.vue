<script setup lang="ts">
import { onMounted, ref } from "vue";
import { flushCache, listCacheEntries } from "@/services/cache";
import { apiErrorMessage } from "@/services/errors";
import type { CacheEntry } from "@/types/domain";

const flushing = ref(false);
const flushError = ref<string | null>(null);
const flushed = ref(false);

const entries = ref<CacheEntry[]>([]);
const cacheLoading = ref(true);
const cacheError = ref<string | null>(null);
const search = ref("");

const headers = [
  { title: "Domain", key: "domain" },
  { title: "Type", key: "qtype" },
  { title: "Class", key: "qclass" },
  { title: "Response", key: "response" },
  { title: "Answers", key: "answers", align: "end" as const },
  { title: "TTL (s)", key: "ttl", align: "end" as const },
  { title: "Remaining (s)", key: "remaining_ttl", align: "end" as const },
  { title: "Expires", key: "expires_at" },
  { title: "Updated", key: "updated_at" }
];

async function loadCache(): Promise<void> {
  cacheLoading.value = true;
  cacheError.value = null;
  try {
    entries.value = await listCacheEntries();
  } catch (e) {
    cacheError.value = apiErrorMessage(e);
    entries.value = [];
  } finally {
    cacheLoading.value = false;
  }
}

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

// Datetimes arrive without an offset (container-local); render those raw parts.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

onMounted(() => {
  void loadCache();
});
</script>

<template>
  <div>
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

    <v-sheet
      rounded="lg"
      color="surface-card"
      class="cache-table-card mt-6"
    >
      <v-card-title class="d-flex flex-wrap align-center ga-2 px-4 py-3">
        <span class="text-h6 text-sm-h5 text-md-h4 cache-table-title">Cache Entries</span>
        <v-spacer />
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          placeholder="Filter cache"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="cache-search"
        />
        <v-btn
          :loading="cacheLoading"
          icon="mdi-refresh"
          variant="text"
          size="small"
          @click="loadCache"
        />
      </v-card-title>
      <v-divider />

      <v-alert
        v-if="cacheError"
        type="error"
        variant="tonal"
        density="compact"
        class="ma-3"
      >
        {{ cacheError }}
      </v-alert>

      <v-data-table
        v-else
        :headers="headers"
        :items="entries"
        :search="search"
        :loading="cacheLoading"
        density="compact"
        class="app-table"
        mobile-breakpoint="md"
        :items-per-page="25"
        no-data-text="Cache is empty."
      >
        <template #item.expires_at="{ item }">
          <span class="date-column">{{ formatDateTime(item.expires_at) }}</span>
        </template>
        <template #item.updated_at="{ item }">
          <span class="date-column">{{ formatDateTime(item.updated_at) }}</span>
        </template>
      </v-data-table>
    </v-sheet>
  </div>
</template>

<style scoped>
.cache-table-card {
  overflow: hidden;
}

.cache-table-title {
  font-family: var(--app-font-family);
  color: #b1b8c0;
}

.cache-search {
  max-width: 260px;
}
</style>

