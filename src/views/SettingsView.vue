<script setup lang="ts">
import { ref } from "vue";
import { useDisplay } from "vuetify";
import GeneralSettingsPanel from "@/components/settings/GeneralSettingsPanel.vue";
import PoliciesPanel from "@/components/settings/PoliciesPanel.vue";
import UpstreamsPanel from "@/components/settings/UpstreamsPanel.vue";
import BlocklistsPanel from "@/components/settings/BlocklistsPanel.vue";

// Tabs render vertically on desktop (lg+) and as a horizontal scrollable bar on
// phones & tablets (< lg), where the narrow rail would otherwise squeeze the form.
const { lgAndUp } = useDisplay();
const activeTab = ref("general");
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
          v-model="activeTab"
          :direction="lgAndUp ? 'vertical' : 'horizontal'"
          :show-arrows="!lgAndUp"
          color="primary"
        >
          <v-tab value="general">
            General
          </v-tab>
          <v-tab value="policies">
            Policies
          </v-tab>
          <v-tab value="upstreams">
            Upstreams
          </v-tab>
          <v-tab value="blocklists">
            Blocklists
          </v-tab>
        </v-tabs>
      </v-col>

      <!-- Right content -->
      <v-col
        cols="12"
        lg="9"
      >
        <v-card-text>
          <v-window v-model="activeTab">
            <v-window-item value="general">
              <h3>General Settings</h3>
              <v-divider class="my-4" />
              <GeneralSettingsPanel />
            </v-window-item>

            <v-window-item value="policies">
              <h3>Policies</h3>
              <v-divider class="my-4" />
              <PoliciesPanel />
            </v-window-item>

            <v-window-item value="upstreams">
              <h3>Upstreams</h3>
              <v-divider class="my-4" />
              <UpstreamsPanel />
            </v-window-item>

            <v-window-item value="blocklists">
              <h3>Blocklists</h3>
              <v-divider class="my-4" />
              <BlocklistsPanel />
            </v-window-item>
          </v-window>
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
