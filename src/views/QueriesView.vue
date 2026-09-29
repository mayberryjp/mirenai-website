<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useQueriesStore } from "@/stores/queries";
import { useClientsStore } from "@/stores/clients";
import AsyncState from "@/components/base/AsyncState.vue";

const store = useQueriesStore();
const clients = useClientsStore();
const { items, total, loading, error, page } = storeToRefs(store);

const headers = [
  { title: "Client", key: "client" },
  { title: "Domain", key: "domain" },
  { title: "Type", key: "qtype" },
  { title: "Count", key: "count" },
  { title: "Last action", key: "last_action" },
  { title: "Last seen", key: "last_seen" }
];

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / store.pageSize)));

// Debounced so we issue one request after typing settles, not per keystroke.
const searchInput = ref("");
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (val) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void store.setSearch((val ?? "").trim()), 300);
});

const confirmClear = ref(false);
const clearing = ref(false);

async function clear(): Promise<void> {
  clearing.value = true;
  try {
    await store.clear();
    confirmClear.value = false;
  } finally {
    clearing.value = false;
  }
}

onMounted(() => {
  void store.load();
  // Device-name lookup for the Client column; best-effort, IP is the fallback.
  if (!clients.loaded) void clients.load();
});
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <h1 class="text-h5">
        Query Log
      </h1>
      <v-spacer />
      <v-text-field
        v-model="searchInput"
        prepend-inner-icon="mdi-magnify"
        placeholder="Search client or domain"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="query-search"
      />
      <v-btn
        color="error"
        variant="tonal"
        prepend-icon="mdi-delete-sweep"
        @click="confirmClear = true"
      >
        Clear all
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No queries logged yet."
    >
      <v-sheet
        rounded="lg"
        color="#090c10"
      >
        <v-data-table
          :headers="headers"
          :items="items"
          density="compact"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="store.pageSize"
          hide-default-footer
        >
          <template #item.client="{ item }">
            {{ clients.nameFor(item.client) }}
          </template>
          <template #item.last_action="{ item }">
            {{ item.last_action ?? "—" }}
          </template>
          <template #item.last_seen="{ item }">
            <span class="date-column">{{ item.last_seen }}</span>
          </template>
        </v-data-table>
        <div class="d-flex justify-center pa-2">
          <v-pagination
            :model-value="page"
            :length="pageCount"
            :total-visible="7"
            @update:model-value="store.setPage"
          />
        </div>
      </v-sheet>
    </AsyncState>

    <v-dialog
      v-model="confirmClear"
      max-width="440"
    >
      <v-card>
        <v-card-title>Clear query log</v-card-title>
        <v-card-text>This permanently deletes all query statistics. This cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmClear = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="clearing"
            @click="clear"
          >
            Clear all
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.query-search {
  max-width: 320px;
}
</style>

