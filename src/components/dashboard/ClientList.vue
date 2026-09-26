<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import { useClientsStore } from "@/stores/clients";
import AsyncState from "@/components/base/AsyncState.vue";

const store = useClientsStore();
const route = useRoute();
const router = useRouter();

const { lgAndUp } = useDisplay();
// Mobile/tablet = below the lg breakpoint, matching where AppLayout stacks the columns.
const isMobile = computed(() => !lgAndUp.value);

const searchTerm = ref("");

const filteredClients = computed(() => {
  const q = searchTerm.value.trim().toLowerCase();
  if (!q) return store.clients;
  return store.clients.filter((c) => c.client.toLowerCase().includes(q));
});

const selectedClient = computed(() =>
  route.name === "client" ? (route.params.client as string) : null
);
const isClientSelected = (client: string): boolean => client === selectedClient.value;
const selectedClientName = computed(() => selectedClient.value);

// List starts collapsed on mobile; on desktop it is always shown.
const listExpanded = ref(false);
const toggleList = (): void => {
  listExpanded.value = !listExpanded.value;
};
const showList = computed(() => !isMobile.value || listExpanded.value);

function selectClient(client: string): void {
  router.push({ name: "client", params: { client } });
  // Collapse the mobile accordion so the detail page is in view after selecting.
  listExpanded.value = false;
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

onMounted(() => {
  if (!store.loaded) void store.load();
});
</script>

<template>
  <v-sheet
    rounded="lg"
    height="100%"
    color="#0d1117"
    class="client-list custom-scrollbar"
  >
    <!-- Overview header (compact on mobile via .is-mobile) -->
    <div
      class="site-risk-header"
      :class="isMobile ? 'pa-3 is-mobile' : 'pa-6'"
    >
      <div class="site-risk-header-content">
        <span class="site-risk-label">CLIENTS: </span>
        <span
          class="site-risk-desc"
          :style="{ color: '#2EC4A0' }"
        >
          {{ store.total }}
        </span>
      </div>
    </div>

    <!-- Selected client name (mobile only): tells the user which client is open -->
    <div
      v-if="isMobile && selectedClientName"
      class="viewing-host px-3 pb-1"
    >
      Viewing: <span class="viewing-host-name">{{ selectedClientName }}</span>
    </div>

    <!-- Accordion toggle (mobile only): collapses the search + list -->
    <button
      v-if="isMobile"
      type="button"
      class="host-list-toggle px-3 py-2"
      :aria-expanded="listExpanded"
      @click="toggleList"
    >
      <v-icon
        size="20"
        class="mr-1"
      >
        {{ listExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
      </v-icon>
      <span class="host-list-toggle-label">
        Clients<template v-if="selectedClientName"> — {{ selectedClientName }}</template>
      </span>
    </button>

    <v-expand-transition>
      <div v-show="showList">
        <!-- Search Filter -->
        <div class="search-container pa-3">
          <v-text-field
            v-model="searchTerm"
            density="compact"
            variant="outlined"
            placeholder="Search clients..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            class="search-field"
            clearable
            @click:clear="searchTerm = ''"
          />
        </div>

        <AsyncState
          :loading="store.loading"
          :error="store.error"
          :empty="!store.loading && filteredClients.length === 0"
          empty-text="No clients have made queries yet."
        >
          <v-list>
            <v-list-item
              v-for="c in filteredClients"
              :key="c.client"
              class="host-list-item"
              :class="{ 'selected-host': isClientSelected(c.client) }"
              @click="selectClient(c.client)"
            >
              <div class="d-flex align-center w-100">
                <!-- Icon container with fixed width for alignment -->
                <div class="icon-container">
                  <v-icon
                    size="24"
                    color="#64B5F6"
                  >
                    mdi-monitor
                  </v-icon>
                </div>

                <!-- Client info with consistent left margin -->
                <div class="host-info">
                  {{ c.client }}
                </div>

                <!-- Query count (right-aligned, like the reference threat score) -->
                <div class="threat-score-text ml-auto">
                  {{ formatCount(c.total_queries) }}
                </div>
              </div>
            </v-list-item>
          </v-list>
        </AsyncState>
      </div>
    </v-expand-transition>
  </v-sheet>
</template>

<style scoped>
.v-list {
  background-color: transparent;
}

.client-list {
  overflow-y: auto;
}

.host-list-item {
  margin-bottom: 8px;
  padding: 8px 16px;
  color: #b1b8c0;
  text-transform: uppercase;
  transition: background-color 0.2s ease;
}

.host-list-item.selected-host {
  background-color: rgba(66, 165, 245, 0.2);
  border-left: 3px solid #42a5f5;
}

.host-info {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 0;
  margin-left: 0;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-width: 40px;
}

.search-container {
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: #0d1117;
}

.search-field {
  background-color: #161b22;
}

.search-field :deep(.v-field__input) {
  color: #b1b8c0;
}

.search-field :deep(.v-field__outline) {
  opacity: 0.3;
}

.threat-score-text {
  font-size: 14px;
  font-weight: bold;
  min-width: 56px;
  text-align: right;
  color: #2ec4a0;
  white-space: nowrap;
}

/* Subtle custom scrollbar */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  border: none;
}

.site-risk-header {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #161b22;
  border-radius: 12px 12px 0 0;
  margin-bottom: 0;
  justify-content: center;
}

.site-risk-label {
  font-size: 28px;
  font-weight: 700;
  color: #b1b8c0;
  letter-spacing: 1px;
  margin-right: 8px;
}

.site-risk-desc {
  font-size: 28px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.85;
}

/* Compact header on mobile (class applied via :class="...is-mobile") */
.site-risk-header.is-mobile .site-risk-label,
.site-risk-header.is-mobile .site-risk-desc {
  font-size: 18px;
}

/* Selected-client line under the header (mobile only) */
.viewing-host {
  background: #161b22;
  color: #8b949e;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.viewing-host-name {
  color: #b1b8c0;
  font-weight: 700;
}

/* Accordion toggle button (mobile only) */
.host-list-toggle {
  display: flex;
  align-items: center;
  width: 100%;
  background: #161b22;
  color: #b1b8c0;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
}

.host-list-toggle:hover {
  background: #1c232c;
}

.host-list-toggle-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
