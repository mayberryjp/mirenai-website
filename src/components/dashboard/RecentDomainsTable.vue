<script setup lang="ts">
import { useClientsStore } from "@/stores/clients";
import type { RecentNewDomain } from "@/types/domain";

withDefaults(
  defineProps<{
    rows: RecentNewDomain[];
    loading: boolean;
    error: string | null;
    title?: string;
  }>(),
  { title: "Recent Domains" }
);

const clients = useClientsStore();

const headers = [
  { title: "Client", key: "client" },
  { title: "Domain", key: "domain" },
  { title: "Action", key: "last_action" },
  { title: "First Seen", key: "first_seen" }
];

// Map the policy action to the same label/colour as the client policy table.
function actionLabel(action: string | null): string {
  switch (action) {
    case "forward":
      return "Allow";
    case "deny":
      return "Block";
    case "override":
      return "Spoof";
    case "blocklist":
      return "Blocklist";
    case "default":
      return "Default";
    default:
      return "—";
  }
}

function actionColor(action: string | null): string {
  switch (action) {
    case "deny":
      return "error"; // Block — red
    case "override":
      return "warning"; // Spoof — orange
    case "blocklist":
      return "burgundy"; // Blocklist — deep red
    default:
      return "grey"; // Allow / Default / none
  }
}

// Datetimes arrive without an offset (container-local); render in that same local
// wall-clock, matching the traffic chart's formatting.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <v-card
    color="surface-card"
    class="recent-domains-card"
  >
    <v-card-title class="d-flex align-center px-4 py-3">
      <span class="text-h6 text-sm-h5 recent-domains-title">{{ title }}</span>
      <v-spacer />
      <span class="text-caption text-grey">Newest first</span>
    </v-card-title>
    <v-divider />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="ma-3"
    >
      {{ error }}
    </v-alert>

    <v-data-table
      v-else
      :headers="headers"
      :items="rows"
      :loading="loading"
      density="comfortable"
      class="app-table"
      mobile-breakpoint="md"
      :items-per-page="25"
      no-data-text="No domains recorded yet."
    >
      <template #item.client="{ item }">
        {{ clients.nameFor(item.client) }}
      </template>

      <template #item.last_action="{ item }">
        <v-chip
          size="small"
          variant="tonal"
          :color="actionColor(item.last_action)"
        >
          {{ actionLabel(item.last_action) }}
        </v-chip>
      </template>

      <template #item.first_seen="{ item }">
        {{ formatDateTime(item.first_seen) }}
      </template>
    </v-data-table>
  </v-card>
</template>

<style scoped>
.recent-domains-card {
  overflow: hidden;
}

.recent-domains-title {
  font-family: var(--app-font-family);
  color: #ffffff;
}
</style>
