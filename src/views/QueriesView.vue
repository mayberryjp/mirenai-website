<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useQueriesStore } from "@/stores/queries";
import AsyncState from "@/components/base/AsyncState.vue";

const store = useQueriesStore();
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
});
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">
        Query Log
      </h1>
      <v-spacer />
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
      <v-card color="surface-card">
        <v-data-table
          :headers="headers"
          :items="items"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="store.pageSize"
          hide-default-footer
        >
          <template #item.last_action="{ item }">
            {{ item.last_action ?? "—" }}
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
      </v-card>
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
