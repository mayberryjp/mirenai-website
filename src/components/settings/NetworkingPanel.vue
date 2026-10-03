<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useTrustedNetworksStore } from "@/stores/trustedNetworks";
import { getSiteStats } from "@/services/stats";
import { listForeignClients } from "@/services/foreignClients";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import ForeignTrafficChart from "@/components/dashboard/ForeignTrafficChart.vue";
import type {
  ForeignClient,
  SiteHourlyStat,
  TrustedNetwork,
  TrustedNetworkCreate
} from "@/types/domain";

const store = useTrustedNetworksStore();
const { items, loading, error } = storeToRefs(store);

const headers = [
  { title: "CIDR", key: "cidr" },
  { title: "Description", key: "description" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

const foreignHeaders = [
  { title: "Source IP", key: "ip" },
  { title: "Denied hits", key: "hits", align: "end" as const },
  { title: "First seen", key: "first_seen" },
  { title: "Last seen", key: "last_seen" }
];

interface NetworkForm {
  cidr: string;
  description: string;
}

function emptyForm(): NetworkForm {
  return { cidr: "", description: "" };
}

const dialog = ref(false);
const form = reactive<NetworkForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

async function submit(): Promise<void> {
  const cidr = form.cidr.trim();
  if (!cidr) {
    formError.value = "CIDR is required.";
    return;
  }
  saving.value = true;
  formError.value = null;
  const body: TrustedNetworkCreate = {
    cidr,
    description: form.description.trim() || null
  };
  try {
    await store.create(body);
    dialog.value = false;
  } catch (e) {
    // 409 conflict (duplicate CIDR) surfaces here via the normalized message.
    formError.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

const confirmDelete = ref<TrustedNetwork | null>(null);
const deleting = ref(false);

async function remove(): Promise<void> {
  if (!confirmDelete.value) return;
  deleting.value = true;
  try {
    await store.remove(confirmDelete.value.id);
    confirmDelete.value = null;
  } finally {
    deleting.value = false;
  }
}

// Last 100 hours of foreign-network traffic for the bottom chart (GET /stats/site).
const siteStats = ref<SiteHourlyStat[]>([]);
const siteLoading = ref(true);
const siteError = ref<string | null>(null);

async function loadSiteStats(): Promise<void> {
  siteLoading.value = true;
  siteError.value = null;
  try {
    siteStats.value = await getSiteStats(100);
  } catch (e) {
    siteError.value = apiErrorMessage(e);
    siteStats.value = [];
  } finally {
    siteLoading.value = false;
  }
}

// Denied foreign clients (source IPs outside every trusted network). Fetch the
// top 100 by last_seen and page through them client-side, 25 per page.
const FOREIGN_CLIENTS_LIMIT = 100;
const FOREIGN_CLIENTS_PAGE_SIZE = 25;

const foreignClients = ref<ForeignClient[]>([]);
const foreignLoading = ref(true);
const foreignError = ref<string | null>(null);
const foreignPage = ref(1);
const foreignPageCount = computed(() =>
  Math.max(1, Math.ceil(foreignClients.value.length / FOREIGN_CLIENTS_PAGE_SIZE))
);

async function loadForeignClients(): Promise<void> {
  foreignLoading.value = true;
  foreignError.value = null;
  try {
    const page = await listForeignClients(FOREIGN_CLIENTS_LIMIT);
    foreignClients.value = page.items;
    foreignPage.value = 1;
  } catch (e) {
    foreignError.value = apiErrorMessage(e);
    foreignClients.value = [];
  } finally {
    foreignLoading.value = false;
  }
}

// Datetimes arrive without an offset (container-local); render that same local
// wall-clock, matching the dashboard tables (no timezone conversion).
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
  void store.load();
  void loadSiteStats();
  void loadForeignClients();
});
</script>

<template>
  <div>
    <p class="text-caption text-medium-emphasis mb-4">
      Only queries whose source IP falls inside one of these subnets are answered — others are
      dropped before parsing. With no networks configured the resolver replies to everyone, so this
      is opt-in. CIDRs are canonicalized on save (e.g. 10.2.10.5/24 → 10.2.10.0/24).
    </p>

    <div class="d-flex align-center mb-4">
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New network
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No trusted networks configured — the resolver answers every client."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="headers"
          :items="items"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="-1"
          hide-default-footer
        >
          <template #item.description="{ item }">
            {{ item.description ?? "—" }}
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              title="Delete network"
              @click="confirmDelete = item"
            />
          </template>
        </v-data-table>
      </v-card>
    </AsyncState>

    <ForeignTrafficChart
      :stats="siteStats"
      :loading="siteLoading"
      :error="siteError"
      class="mt-4"
    />

    <div class="text-subtitle-1 font-weight-medium mt-6 mb-1">
      Denied foreign clients
    </div>
    <p class="text-caption text-medium-emphasis mb-3">
      Source IPs outside every trusted network whose queries were dropped before parsing, with a
      running count of denied hits. Newest activity first.
    </p>

    <AsyncState
      :loading="foreignLoading"
      :error="foreignError"
      :empty="foreignClients.length === 0"
      empty-text="No foreign clients have been denied."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="foreignHeaders"
          :items="foreignClients"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
          :items-per-page="FOREIGN_CLIENTS_PAGE_SIZE"
          :page="foreignPage"
          hide-default-footer
        >
          <template #item.hits="{ item }">
            {{ item.hits.toLocaleString() }}
          </template>
          <template #item.first_seen="{ item }">
            <span class="date-column">{{ formatDateTime(item.first_seen) }}</span>
          </template>
          <template #item.last_seen="{ item }">
            <span class="date-column">{{ formatDateTime(item.last_seen) }}</span>
          </template>
        </v-data-table>
        <div
          v-if="foreignPageCount > 1"
          class="d-flex justify-center pa-2"
        >
          <v-pagination
            :model-value="foreignPage"
            :length="foreignPageCount"
            :total-visible="7"
            @update:model-value="foreignPage = $event"
          />
        </div>
      </v-card>
    </AsyncState>

    <v-dialog
      v-model="dialog"
      max-width="560"
    >
      <v-card>
        <v-card-title>New network</v-card-title>
        <v-card-text>
          <v-alert
            v-if="formError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ formError }}
          </v-alert>
          <v-text-field
            v-model="form.cidr"
            label="CIDR (e.g. 10.0.0.0/24)"
            autofocus
          />
          <v-text-field
            v-model="form.description"
            label="Description (optional)"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="dialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            @click="submit"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      :model-value="confirmDelete !== null"
      max-width="420"
      @update:model-value="confirmDelete = null"
    >
      <v-card>
        <v-card-title>Delete network</v-card-title>
        <v-card-text>
          Delete trusted network <strong>{{ confirmDelete?.cidr }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmDelete = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            @click="remove"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
