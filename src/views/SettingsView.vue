<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useDisplay } from "vuetify";

// Each panel is its own child route under /settings; the tab rail just navigates
// between them. Tabs render vertically on desktop (lg+) and as a horizontal
// scrollable bar on phones & tablets (< lg), where the narrow rail would
// otherwise squeeze the form.
const { lgAndUp } = useDisplay();
const route = useRoute();

interface SettingsTab {
  value: string;
  title: string;
  heading: string;
  routeName: string;
}

const tabs: SettingsTab[] = [
  { value: "general", title: "General", heading: "General Settings", routeName: "settings-general" },
  { value: "policies", title: "Policies", heading: "Policies", routeName: "settings-policies" },
  { value: "upstreams", title: "Upstreams", heading: "Upstreams", routeName: "settings-upstreams" },
  { value: "blocklists", title: "Blocklists", heading: "Blocklists", routeName: "settings-blocklists" },
  { value: "networking", title: "Networking", heading: "Networking", routeName: "settings-networking" }
];

const activeTab = computed(() => tabs.find((t) => t.routeName === route.name)?.value ?? "general");
const activeHeading = computed(() => tabs.find((t) => t.routeName === route.name)?.heading ?? "");
</script>

<template>
  <v-sheet
    class="settings-container"
    color="surface-card"
  >
    <v-row no-gutters>
      <!-- Left tab rail -->
      <v-col
        cols="12"
        lg="3"
      >
        <v-tabs
          :model-value="activeTab"
          :direction="lgAndUp ? 'vertical' : 'horizontal'"
          :show-arrows="!lgAndUp"
          color="primary"
        >
          <v-tab
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            :to="{ name: tab.routeName }"
          >
            {{ tab.title }}
          </v-tab>
        </v-tabs>
      </v-col>

      <!-- Right content: the active child route renders here -->
      <v-col
        cols="12"
        lg="9"
      >
        <v-card-text>
          <h3>{{ activeHeading }}</h3>
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
