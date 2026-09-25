<script setup lang="ts">
import { useRoute } from "vue-router";
import { useDisplay } from "vuetify";
import { navItems, githubLink } from "@/constants/navigation";
import { useUiStore } from "@/stores/ui";

const route = useRoute();
// Collapse to a hamburger drawer below the lg breakpoint (1280px).
const { lgAndUp } = useDisplay();
const ui = useUiStore();
</script>

<template>
  <v-app-bar
    color="background-100"
    flat
  >
    <!-- Product logo + name (left); the whole block links to the dashboard -->
    <router-link
      :to="{ name: 'dashboard' }"
      class="product-branding d-flex align-center text-decoration-none ms-2 ms-lg-8"
    >
      <v-icon
        icon="mdi-dns"
        size="30"
        color="#2ec4a0"
        class="mr-3"
      />
      <span class="product-name text-subtitle-1 text-lg-h5">
        mirenai
        <span class="product-bar tagline">|</span>
        <span class="tagline-text tagline">Know Your DNS</span>
      </span>
    </router-link>

    <v-spacer />

    <!-- Desktop navigation (full inline button row) -->
    <div
      v-if="lgAndUp"
      class="d-flex align-center"
    >
      <v-btn
        v-for="item in navItems"
        :key="item.title"
        :to="item.routeName ? { name: item.routeName } : undefined"
        :href="item.href"
        :target="item.href ? '_blank' : undefined"
        :rel="item.href ? 'noopener noreferrer' : undefined"
        variant="text"
        class="mx-2"
        rounded
        :color="item.routeName && route.name === item.routeName ? 'rose' : ''"
      >
        <v-icon start>
          {{ item.icon }}
        </v-icon>
        {{ item.title }}
      </v-btn>

      <!-- External Requests & Roadmap link -->
      <v-btn
        :href="githubLink.href"
        target="_blank"
        rel="noopener noreferrer"
        variant="text"
        class="mx-2"
        rounded
      >
        <v-icon start>
          {{ githubLink.icon }}
        </v-icon>
        {{ githubLink.title }}
      </v-btn>

      <v-btn
        icon
        class="ml-2"
        aria-label="Profile"
      >
        <v-avatar
          color="burgundy"
          size="36"
        >
          <v-icon icon="mdi-account" />
        </v-avatar>
      </v-btn>
    </div>

    <!-- Mobile / tablet: profile + hamburger (drawer renders in AppLayout) -->
    <div
      v-else
      class="d-flex align-center"
    >
      <v-btn
        icon
        class="ml-1"
        aria-label="Profile"
      >
        <v-avatar
          color="burgundy"
          size="36"
        >
          <v-icon icon="mdi-account" />
        </v-avatar>
      </v-btn>
      <v-app-bar-nav-icon
        aria-label="Open navigation menu"
        @click="ui.toggleNavDrawer()"
      />
    </div>
  </v-app-bar>
</template>

<style scoped>
.v-app-bar {
  border-bottom: 0 !important;
  box-shadow: none !important;
}

.product-branding {
  margin-top: 5px;
  height: 48px;
}

.mx-2 {
  text-transform: capitalize;
  color: #b1b8c0;
  font-size: 16px !important;
  font-weight: 400;
  letter-spacing: 0em !important;
}

/* Branding colour/weight only — size comes from Vuetify text utilities */
.product-name {
  color: #2ec4a0;
  font-weight: 700;
  text-align: start;
  line-height: 1.4;
  letter-spacing: 0.05em !important;
  white-space: nowrap;
}

.product-bar {
  color: #2196f3;
  font-weight: 700;
  margin-right: 8px;
  letter-spacing: 0.05em !important;
}

.tagline-text {
  color: #64b5f6;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.05em !important;
}

/* Tagline hidden by default; shown only >= 1500px where nav + branding both fit. */
.tagline {
  display: none;
}

@media (min-width: 1500px) {
  .tagline {
    display: inline;
  }
}
</style>
