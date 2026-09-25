<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useBlocklistsStore } from "@/stores/blocklists";
import { listBlocklistDomains } from "@/services/blocklists";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import type { Blocklist, BlocklistCreate } from "@/types/domain";

const store = useBlocklistsStore();
const { items, loading, error, refreshingId } = storeToRefs(store);

const headers = [
  { title: "Name", key: "name" },
  { title: "URL", key: "url" },
  { title: "Interval (h)", key: "update_interval_hours" },
  { title: "Domains", key: "domain_count" },
  { title: "Last status", key: "last_status" },
  { title: "Enabled", key: "enabled" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

interface BlocklistForm {
  name: string;
  url: string;
  update_interval_hours: number;
  enabled: boolean;
}

function emptyForm(): BlocklistForm {
  return { name: "", url: "", update_interval_hours: 24, enabled: true };
}

const dialog = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<BlocklistForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

function openEdit(row: Blocklist): void {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name,
    url: row.url,
    update_interval_hours: row.update_interval_hours,
    enabled: row.enabled
  });
  formError.value = null;
  dialog.value = true;
}

async function submit(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const body: BlocklistCreate = {
    name: form.name.trim(),
    url: form.url.trim(),
    update_interval_hours: form.update_interval_hours,
    enabled: form.enabled
  };
  try {
    if (editingId.value === null) {
      await store.create(body);
    } else {
      await store.update(editingId.value, body);
    }
    dialog.value = false;
  } catch (e) {
    formError.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

const refreshError = ref<string | null>(null);

async function refresh(row: Blocklist): Promise<void> {
  refreshError.value = null;
  try {
    await store.refresh(row.id);
  } catch (e) {
    // 502 download_failed carries a detail explaining why (spec §7.4).
    refreshError.value = apiErrorMessage(e);
  }
}

const confirmDelete = ref<Blocklist | null>(null);
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

// ---- Domain viewer (paginated; lists can be very large) ----
const domainsDialog = ref(false);
const domainsFor = ref<Blocklist | null>(null);
const domains = ref<string[]>([]);
const domainsTotal = ref(0);
const domainsPage = ref(1);
const domainsLoading = ref(false);
const domainsError = ref<string | null>(null);
const DOMAINS_PAGE_SIZE = 100;

async function loadDomains(): Promise<void> {
  if (!domainsFor.value) return;
  domainsLoading.value = true;
  domainsError.value = null;
  try {
    const offset = (domainsPage.value - 1) * DOMAINS_PAGE_SIZE;
    const res = await listBlocklistDomains(domainsFor.value.id, DOMAINS_PAGE_SIZE, offset);
    domains.value = res.items;
    domainsTotal.value = res.total;
  } catch (e) {
    domainsError.value = apiErrorMessage(e);
  } finally {
    domainsLoading.value = false;
  }
}

function openDomains(row: Blocklist): void {
  domainsFor.value = row;
  domainsPage.value = 1;
  domainsDialog.value = true;
  void loadDomains();
}

function changeDomainsPage(next: number): void {
  domainsPage.value = next;
  void loadDomains();
}

onMounted(() => {
  void store.load();
});
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">
        Blocklists
      </h1>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New blocklist
      </v-btn>
    </div>

    <v-alert
      v-if="refreshError"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="refreshError = null"
    >
      {{ refreshError }}
    </v-alert>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No blocklists configured."
    >
      <v-card variant="tonal">
        <v-data-table
          :headers="headers"
          :items="items"
          density="comfortable"
        >
          <template #item.url="{ item }">
            <span
              class="text-truncate d-inline-block"
              style="max-width: 260px"
            >{{ item.url }}</span>
          </template>
          <template #item.last_status="{ item }">
            {{ item.last_status ?? "—" }}
          </template>
          <template #item.enabled="{ item }">
            <v-chip
              :color="item.enabled ? 'success' : 'error'"
              size="small"
              variant="tonal"
            >
              {{ item.enabled ? "yes" : "no" }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-refresh"
              variant="text"
              size="small"
              :loading="refreshingId === item.id"
              title="Refresh now"
              @click="refresh(item)"
            />
            <v-btn
              icon="mdi-format-list-bulleted"
              variant="text"
              size="small"
              title="View domains"
              @click="openDomains(item)"
            />
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              @click="openEdit(item)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              @click="confirmDelete = item"
            />
          </template>
        </v-data-table>
      </v-card>
    </AsyncState>

    <v-dialog
      v-model="dialog"
      max-width="560"
    >
      <v-card>
        <v-card-title>{{ editingId === null ? "New blocklist" : "Edit blocklist" }}</v-card-title>
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
            v-model="form.name"
            label="Name"
          />
          <v-text-field
            v-model="form.url"
            label="Source URL (http/https)"
          />
          <v-text-field
            v-model.number="form.update_interval_hours"
            type="number"
            label="Update interval (hours, >= 1)"
          />
          <v-switch
            v-model="form.enabled"
            label="Enabled"
            color="primary"
          />
          <p class="text-caption text-medium-emphasis">
            New blocklists are not downloaded on create — use refresh to populate the domain count.
          </p>
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
      max-width="440"
      @update:model-value="confirmDelete = null"
    >
      <v-card>
        <v-card-title>Delete blocklist</v-card-title>
        <v-card-text>
          Delete <strong>{{ confirmDelete?.name }}</strong> and all its stored domains?
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

    <v-dialog
      v-model="domainsDialog"
      max-width="640"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          Domains — {{ domainsFor?.name }}
          <v-spacer />
          <span class="text-caption text-medium-emphasis">{{ domainsTotal }} total</span>
        </v-card-title>
        <v-card-text>
          <AsyncState
            :loading="domainsLoading"
            :error="domainsError"
            :empty="!domainsLoading && domains.length === 0"
            empty-text="No domains stored yet — try refreshing."
          >
            <v-list
              density="compact"
              max-height="360"
              class="overflow-y-auto"
            >
              <v-list-item
                v-for="d in domains"
                :key="d"
                :title="d"
              />
            </v-list>
            <v-pagination
              v-if="domainsTotal > DOMAINS_PAGE_SIZE"
              :model-value="domainsPage"
              :length="Math.ceil(domainsTotal / DOMAINS_PAGE_SIZE)"
              :total-visible="5"
              class="mt-2"
              @update:model-value="changeDomainsPage"
            />
          </AsyncState>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="domainsDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
