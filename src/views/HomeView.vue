<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { usePoliciesStore } from "@/stores/policies";
import { useUpstreamsStore } from "@/stores/upstreams";
import { useBlocklistsStore } from "@/stores/blocklists";
import { getHealth, getReady } from "@/services/health";
import { apiErrorMessage } from "@/services/errors";

const policies = usePoliciesStore();
const upstreams = useUpstreamsStore();
const blocklists = useBlocklistsStore();

const { total: policyTotal } = storeToRefs(policies);
const { total: upstreamTotal } = storeToRefs(upstreams);
const { total: blocklistTotal } = storeToRefs(blocklists);

const ready = ref<boolean | null>(null);
const service = ref<string | null>(null);
const healthError = ref<string | null>(null);

const cards = computed(() => [
  { title: "Policies", value: policyTotal.value, to: "/policies", icon: "mdi-shield-key" },
  { title: "Upstreams", value: upstreamTotal.value, to: "/upstreams", icon: "mdi-server-network" },
  { title: "Blocklists", value: blocklistTotal.value, to: "/blocklists", icon: "mdi-cancel" }
]);

async function loadHealth(): Promise<void> {
  healthError.value = null;
  try {
    const [h, r] = await Promise.all([getHealth(), getReady()]);
    service.value = h.service;
    ready.value = r.ready;
  } catch (e) {
    healthError.value = apiErrorMessage(e);
  }
}

onMounted(() => {
  void policies.load();
  void upstreams.load();
  void blocklists.load();
  void loadHealth();
});
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">
      Dashboard
    </h1>

    <v-row>
      <v-col
        v-for="card in cards"
        :key="card.to"
        cols="12"
        sm="4"
      >
        <v-card
          :to="card.to"
          variant="tonal"
          hover
        >
          <v-card-item>
            <template #prepend>
              <v-icon
                :icon="card.icon"
                size="32"
              />
            </template>
            <v-card-title>{{ card.value }}</v-card-title>
            <v-card-subtitle>{{ card.title }}</v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <v-card
      class="mt-4"
      variant="tonal"
    >
      <v-card-title class="text-subtitle-1">
        Server status
      </v-card-title>
      <v-card-text>
        <v-alert
          v-if="healthError"
          type="error"
          variant="tonal"
        >
          {{ healthError }}
        </v-alert>
        <template v-else>
          <div class="d-flex align-center mb-2">
            <v-icon
              :icon="ready ? 'mdi-check-circle' : 'mdi-alert-circle'"
              :color="ready ? 'success' : 'warning'"
              class="mr-2"
            />
            <span>{{ ready === null ? "Checking…" : ready ? "Database reachable" : "Not ready" }}</span>
          </div>
          <div class="text-medium-emphasis">
            Service: {{ service ?? "—" }}
          </div>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>
