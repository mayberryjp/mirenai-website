<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useClientsStore } from "@/stores/clients";
import { usePoliciesStore } from "@/stores/policies";
import PolicyControl from "@/components/base/PolicyControl.vue";
import ActionFilter from "@/components/base/ActionFilter.vue";
import { loggedActionColor, loggedActionLabel } from "@/constants/actions";
import type { LoggedAction, RecentNewDomain } from "@/types/domain";

const props = withDefaults(
  defineProps<{
    rows: RecentNewDomain[];
    loading: boolean;
    error: string | null;
    title?: string;
  }>(),
  { title: "Recent Domains" }
);

const clients = useClientsStore();
const policies = usePoliciesStore();

const search = ref("");
const selectedActions = ref<LoggedAction[]>([]);

// Client-side filter over the loaded rows: match the search text (domain, client
// IP, or resolved device name) AND, when any action chips are selected, the row's
// last_action.
const filteredRows = computed<RecentNewDomain[]>(() => {
  const q = (search.value ?? "").trim().toLowerCase();
  const actions = selectedActions.value;
  return props.rows.filter((r) => {
    if (actions.length && !(r.last_action && actions.includes(r.last_action))) return false;
    if (!q) return true;
    const name = clients.nameFor(r.client).toLowerCase();
    return (
      r.domain.toLowerCase().includes(q) ||
      r.client.toLowerCase().includes(q) ||
      name.includes(q)
    );
  });
});

const headers = [
  { title: "Client", key: "client" },
  { title: "Domain", key: "domain" },
  { title: "Type", key: "last_qtype" },
  { title: "Blocklist", key: "blocked", sortable: false },
  { title: "Action", key: "last_action" },
  { title: "Policy", key: "policy", sortable: false },
  { title: "First Seen", key: "first_seen" }
];


// Blocklist membership of the queried domain (API returns a simple boolean).
function blockedLabel(on: boolean | undefined | null): string {
  if (on === true) return "Yes";
  if (on === false) return "No";
  return "—";
}

function blockedColor(on: boolean | undefined | null): string {
  return on ? "burgundy" : "grey";
}

// Datetimes arrive without an offset (container-local); render in that same local
// wall-clock, matching the traffic chart's formatting.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
  void policies.load();
});
</script>

<template>
  <v-sheet
    rounded="lg"
    color="#090c10"
    class="recent-domains-card"
  >
    <v-card-title class="d-flex flex-wrap align-center ga-2 px-4 py-3">
      <span class="text-h6 text-sm-h5 text-md-h4 recent-domains-title">{{ title }}</span>
      <v-spacer />
      <ActionFilter v-model="selectedActions" logged />
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        placeholder="Filter domains"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="recent-search"
      />
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
      :items="filteredRows"
      :loading="loading"
      density="compact"
      class="app-table"
      mobile-breakpoint="md"
      :items-per-page="25"
      no-data-text="No domains recorded yet."
    >
      <template #item.client="{ item }">
        {{ clients.nameFor(item.client) }}
      </template>

      <template #item.blocked="{ item }">
        <v-chip
          size="small"
          variant="tonal"
          :color="blockedColor(item.blocked)"
        >
          {{ blockedLabel(item.blocked) }}
        </v-chip>
      </template>

      <template #item.last_action="{ item }">
        <v-chip
          size="small"
          variant="tonal"
          :color="loggedActionColor(item.last_action)"
        >
          {{ loggedActionLabel(item.last_action) }}
        </v-chip>
      </template>

      <template #item.last_qtype="{ item }">
        {{ item.last_qtype ?? "—" }}
      </template>

      <template #item.policy="{ item }">
        <PolicyControl
          :client="item.client"
          :domain="item.domain"
        />
      </template>

      <template #item.first_seen="{ item }">
        <span class="date-column">{{ formatDateTime(item.first_seen) }}</span>
      </template>
    </v-data-table>
  </v-sheet>
</template>

<style scoped>
.recent-domains-card {
  overflow: hidden;
}

.recent-domains-title {
  font-family: var(--app-font-family);
  color: #b1b8c0;
}

.recent-search {
  max-width: 260px;
}
</style>
