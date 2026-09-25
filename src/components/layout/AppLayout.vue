<script setup lang="ts">
import { ref } from "vue";

interface NavItem {
  title: string;
  to: string;
  icon: string;
}

const nav: NavItem[] = [
  { title: "Dashboard", to: "/", icon: "mdi-view-dashboard" },
  { title: "Policies", to: "/policies", icon: "mdi-shield-key" },
  { title: "Upstreams", to: "/upstreams", icon: "mdi-server-network" },
  { title: "Blocklists", to: "/blocklists", icon: "mdi-cancel" },
  { title: "Query Log", to: "/queries", icon: "mdi-format-list-bulleted" },
  { title: "Settings", to: "/settings", icon: "mdi-cog" }
];

const drawer = ref(true);
</script>

<template>
  <v-app-bar
    color="surface"
    flat
  >
    <v-app-bar-nav-icon
      aria-label="Toggle navigation"
      @click="drawer = !drawer"
    />
    <v-app-bar-title>mirenai</v-app-bar-title>
  </v-app-bar>

  <v-navigation-drawer
    v-model="drawer"
    color="surface"
  >
    <v-list nav>
      <v-list-item
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.title"
      />
    </v-list>
  </v-navigation-drawer>

  <v-main>
    <v-container fluid>
      <router-view />
    </v-container>
  </v-main>
</template>
