<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const code = computed(() => {
  const raw = route.query.code;
  return typeof raw === "string" ? raw : "not_found";
});
</script>

<template>
  <v-container
    class="fill-height"
    fluid
  >
    <v-row
      justify="center"
      align="center"
    >
      <v-col
        cols="12"
        md="6"
        class="text-center"
      >
        <v-icon
          icon="mdi-alert-circle-outline"
          size="64"
          color="error"
          class="mb-4"
        />
        <h1 class="text-h5 mb-2">
          Something went wrong
        </h1>
        <p class="text-medium-emphasis mb-6">
          Error code: {{ code }}
        </p>
        <v-btn
          color="primary"
          to="/"
        >
          Back to dashboard
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
