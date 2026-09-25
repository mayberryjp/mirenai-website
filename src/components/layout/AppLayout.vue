<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppHeader from "@/components/layout/AppHeader.vue";
import ClientList from "@/components/dashboard/ClientList.vue";
import { navItems, githubLink } from "@/constants/navigation";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const route = useRoute();

// Routes that use the full content width with no client sidebar.
const fullWidthRoute = computed(() =>
  ["queries", "settings"].includes(route.name as string)
);
</script>

<template>
  <v-app>
    <!-- Top navigation bar -->
    <AppHeader />

    <!-- Mobile / tablet slide-out navigation (toggled from AppHeader's hamburger).
         Rendered here at the v-app root so Vuetify positions it within the layout. -->
    <v-navigation-drawer
      v-model="ui.navDrawer"
      temporary
      location="right"
      color="background-100"
    >
      <v-list
        density="comfortable"
        nav
      >
        <v-list-item
          v-for="item in navItems"
          :key="item.title"
          :to="item.routeName ? { name: item.routeName } : undefined"
          :href="item.href"
          :target="item.href ? '_blank' : undefined"
          :rel="item.href ? 'noopener noreferrer' : undefined"
          :prepend-icon="item.icon"
          :title="item.title"
          :active="item.routeName ? route.name === item.routeName : false"
          color="rose"
          @click="ui.closeNavDrawer()"
        />

        <v-divider class="my-2" />

        <v-list-item
          :href="githubLink.href"
          target="_blank"
          rel="noopener noreferrer"
          :prepend-icon="githubLink.icon"
          :title="githubLink.title"
          @click="ui.closeNavDrawer()"
        />
      </v-list>
    </v-navigation-drawer>

    <!-- Main content -->
    <v-main>
      <!-- Single source of page padding for all routed views. -->
      <v-container
        fluid
        class="pa-3 pa-sm-4 pa-lg-6"
      >
        <v-row>
          <!-- Client list sidebar — hidden on full-width routes (queries, settings) -->
          <v-col
            v-if="!fullWidthRoute"
            cols="12"
            lg="3"
            class="client-list-panel"
          >
            <ClientList />
          </v-col>
          <!-- Full width on mobile/tablet; narrows beside the sidebar on lg+ -->
          <v-col
            cols="12"
            :lg="fullWidthRoute ? 12 : 9"
          >
            <router-view />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.v-main {
  background-color: #0a0c10;
  color: rgba(255, 255, 255, 0.87);
}

@media (min-width: 1280px) {
  .client-list-panel {
    position: sticky;
    top: 68px;
    align-self: flex-start;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    height: calc(100vh - 80px);
  }
}
</style>
