<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useTrustedNetworksStore } from "@/stores/trustedNetworks";
import { getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import ForeignTrafficChart from "@/components/dashboard/ForeignTrafficChart.vue";
import type { SiteHourlyStat, TrustedNetwork, TrustedNetworkCreate } from "@/types/domain";

const store = useTrustedNetworksStore();
const { items, loading, error } = storeToRefs(store);

const headers = [
  { title: "CIDR", key: "cidr" },
  { title: "Description", key: "description" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
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

onMounted(() => {
  void store.load();
  void loadSiteStats();
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
