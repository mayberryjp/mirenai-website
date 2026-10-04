<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useDisplay } from "vuetify";

// Each tab is its own child route (/settings/<x>), so pages deep-link and the
// browser back/forward buttons move between settings pages. Tabs render
// vertically on desktop (lg+) and as a horizontal scrollable bar on phones &
// tablets (< lg), where the narrow rail would otherwise squeeze the form.
const { lgAndUp } = useDisplay();
const route = useRoute();

const tabs = [
  { value: "settings-general", label: "General", heading: "General Settings" },
  { value: "settings-upstreams", label: "Upstreams", heading: "Upstream DNS Servers" },
  { value: "settings-blocklists", label: "Blocklists", heading: "Blocklists" },
  {
    value: "settings-blocklist-search",
    label: "Blocklist Search",
    heading: "Blocklist Search"
  },
  {
    value: "settings-blocklist-activity",
    label: "Blocklist Activity",
    heading: "Blocklist Activity"
  },
  { value: "settings-networking", label: "Networking", heading: "Networking" },
  { value: "settings-cache", label: "Cache", heading: "Cache" },
  { value: "settings-cache-miss", label: "Cache Miss", heading: "Cache Miss" }
];

const heading = computed(
  () => tabs.find((tab) => tab.value === route.name)?.heading ?? ""
);
</script>

<template>
  <v-sheet
    class="settings-container"
    color="surface-card"
  >
    <v-row no-gutters>
      <!-- Left tab rail — each tab navigates to its own /settings/<x> route -->
      <v-col
        cols="12"
        lg="3"
      >
        <v-tabs
          :model-value="route.name as string"
          :direction="lgAndUp ? 'vertical' : 'horizontal'"
          :show-arrows="!lgAndUp"
          color="primary"
        >
          <v-tab
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            :to="{ name: tab.value }"
          >
            {{ tab.label }}
          </v-tab>
        </v-tabs>
      </v-col>

      <!-- Right content — the active child route renders here -->
      <v-col
        cols="12"
        lg="9"
      >
        <v-card-text>
          <h3>{{ heading }}</h3>
          <v-divider class="my-4" />
          <router-view />
        </v-card-text>
      </v-col>
    </v-row>
  </v-sheet>
</template>

<style scoped>
.settings-container {
  height: 100%;
}

/* AppLayout provides the page inset, so keep inner content padding minimal. */
.settings-container :deep(.v-card-text) {
  padding: 8px 0 0;
}

/* On desktop the content sits beside the vertical tab rail; add a left gutter. */
@media (min-width: 1280px) {
  .settings-container :deep(.v-card-text) {
    padding: 16px 0 0 16px;
  }
}
</style>
