<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import { useClientsStore } from "@/stores/clients";
import AsyncState from "@/components/base/AsyncState.vue";
import DeviceIcon from "@/components/base/DeviceIcon.vue";
import AlertBars from "@/components/base/AlertBars.vue";

const store = useClientsStore();
const route = useRoute();
const router = useRouter();

const { lgAndUp } = useDisplay();
// Mobile/tablet = below the lg breakpoint, matching where AppLayout stacks the columns.
const isMobile = computed(() => !lgAndUp.value);

const searchTerm = ref("");

type SortMode = "new-domains" | "queries";
const sortMode = ref<SortMode>("new-domains");

const filteredClients = computed(() => {
  const q = searchTerm.value.trim().toLowerCase();
  if (!q) return store.clients;
  return store.clients.filter(
    (c) =>
      c.client.toLowerCase().includes(q) ||
      store.nameFor(c.client).toLowerCase().includes(q)
  );
});

// Total new domains a client has seen across the alert-bar window.
function newDomainCount(client: string): number {
  return store.newDomainsFor(client).reduce((sum, n) => sum + n, 0);
}

// Filtered roster ordered by the active sort toggle: new-domain volume by
// default, or raw query count. Each metric tie-breaks on the other.
const sortedClients = computed(() => {
  const list = [...filteredClients.value];
  if (sortMode.value === "queries") {
    return list.sort(
      (a, b) =>
        b.total_queries - a.total_queries ||
        newDomainCount(b.client) - newDomainCount(a.client)
    );
  }
  return list.sort(
    (a, b) =>
      newDomainCount(b.client) - newDomainCount(a.client) ||
      b.total_queries - a.total_queries
  );
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

// Colour the device icon by recent new-domain volume (sum of the alert bars):
// calm green when quiet, escalating to crimson as new domains pile up.
function iconColor(client: string): string {
  const total = newDomainCount(client);
  if (total === 0) return "#2EC4A0";
  if (total <= 9) return "#FFD600";
  if (total <= 24) return "#FF9800";
  if (total <= 49) return "#F44336";
  return "#B71C1C";
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

          <!-- Sort toggle: order the roster by new-domain volume or query count -->
          <v-btn-toggle
            v-model="sortMode"
            mandatory
            density="compact"
            class="sort-toggle mt-2"
          >
            <v-btn
              value="new-domains"
              size="small"
              class="sort-btn"
            >
              New domains
            </v-btn>
            <v-btn
              value="queries"
              size="small"
              class="sort-btn"
            >
              Client queries
            </v-btn>
          </v-btn-toggle>
        </div>

        <AsyncState
          :loading="store.loading"
          :error="store.error"
          :empty="!store.loading && sortedClients.length === 0"
          empty-text="No clients have made queries yet."
        >
          <v-list>
            <v-list-item
              v-for="c in sortedClients"
              :key="c.client"
              class="host-list-item"
              :class="{ 'selected-host': isClientSelected(c.client) }"
              @click="selectClient(c.client)"
            >
              <div class="d-flex align-center w-100">
                <!-- Icon container with fixed width for alignment -->
                <div class="icon-container">
                  <DeviceIcon
                    :icon="store.iconFor(c.client)"
                    :size="24"
                    :color="iconColor(c.client)"
                  />
                </div>

                <!-- Client info with consistent left margin -->
                <div class="host-info">
                  {{ store.nameFor(c.client) }}
                </div>

                <!-- New-domain activity for this client (last 12 hours) -->
                <AlertBars
                  :alert-intervals="store.newDomainsFor(c.client)"
                  class="ml-2"
                />

                <!-- New domains (orange) / total queries, right-aligned -->
                <div class="threat-score-text">
                  <span class="new-domain-count">{{ formatCount(newDomainCount(c.client)) }}</span>
                  <span class="count-divider">/</span>{{ formatCount(c.total_queries) }}
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
  min-width: 0;
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

.sort-toggle {
  width: 100%;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  overflow: hidden;
}

.sort-toggle .sort-btn {
  flex: 1 1 0;
  min-width: 0;
  color: #8b949e;
  background-color: #161b22;
  font-size: 11px;
  letter-spacing: 0.3px;
}

.sort-toggle .v-btn--active {
  color: #e6edf3;
  background-color: #22303c;
}

.threat-score-text {
  font-size: 13px;
  font-weight: bold;
  min-width: 92px;
  flex-shrink: 0;
  text-align: right;
  color: #2ec4a0;
  white-space: nowrap;
}

.new-domain-count {
  color: #f5822a;
}

.count-divider {
  color: #6e7681;
  margin: 0 3px;
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
