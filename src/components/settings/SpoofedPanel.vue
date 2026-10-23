<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import PolicyMenu from "@/components/base/PolicyMenu.vue";
import BlocklistTrafficChart from "@/components/dashboard/BlocklistTrafficChart.vue";
import { deletePolicy, listPolicies, updatePolicy } from "@/services/policies";
import { getSiteStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import type { Policy, PolicyUpdate, SiteHourlyStat } from "@/types/domain";

const stats = ref<SiteHourlyStat[]>([]);
const statsLoading = ref(false);
const statsError = ref<string | null>(null);
const items = ref<Policy[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = ref(25);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
let requestId = 0;

const headers = [
  { title: "Client", key: "client", sortable: false },
  { title: "Domain", key: "domain", sortable: false },
  { title: "Policy / Answers", key: "policy", sortable: false },
  { title: "TTL (s)", key: "override_ttl", sortable: false },
  { title: "Enabled", key: "enabled", sortable: false },
  { title: "Description", key: "description", sortable: false },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

async function loadRules(): Promise<void> {
  const currentRequest = ++requestId;
  loading.value = true;
  error.value = null;
  try {
    const result = await listPolicies(perPage.value, (page.value - 1) * perPage.value, "override");
    if (currentRequest !== requestId) return;
    total.value = result.total;
    const lastPage = Math.max(1, Math.ceil(result.total / perPage.value));
    if (page.value > lastPage) {
      page.value = lastPage;
      return;
    }
    items.value = result.items;
  } catch (cause) {
    if (currentRequest === requestId) error.value = apiErrorMessage(cause);
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

async function loadTraffic(): Promise<void> {
  statsLoading.value = true;
  statsError.value = null;
  try {
    stats.value = await getSiteStats(100);
  } catch (cause) {
    statsError.value = apiErrorMessage(cause);
  } finally {
    statsLoading.value = false;
  }
}

function refresh(): void {
  void loadRules();
  void loadTraffic();
}

const dialog = ref(false);
const editingId = ref<number | null>(null);
const formError = ref<string | null>(null);
const form = reactive({
  client: "*", domain: "", override_response: "", override_ttl: 300,
  enabled: true, description: ""
});

function openEditor(row: Policy): void {
  editingId.value = row.id;
  Object.assign(form, {
    client: row.client,
    domain: row.domain,
    override_response: row.override_response ?? "",
    override_ttl: row.override_ttl,
    enabled: row.enabled,
    description: row.description ?? ""
  });
  formError.value = null;
  dialog.value = true;
}

async function submit(): Promise<void> {
  if (saving.value || editingId.value === null) return;
  formError.value = null;
  if (!form.client.trim() || !form.domain.trim() || !form.override_response.trim()) {
    formError.value = "Client, domain, and IP answers are required.";
    return;
  }
  if (!Number.isInteger(form.override_ttl) || form.override_ttl < 0) {
    formError.value = "TTL must be a non-negative integer.";
    return;
  }
  const body: PolicyUpdate = {
    client: form.client.trim(), domain: form.domain.trim(), action: "override",
    override_response: form.override_response.trim(), override_ttl: form.override_ttl,
    enabled: form.enabled, description: form.description.trim() || null
  };
  saving.value = true;
  try {
    await updatePolicy(editingId.value, body);
    dialog.value = false;
    await loadRules();
  } catch (cause) {
    formError.value = apiErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}

async function changeRule(row: Policy, body: PolicyUpdate): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = null;
  try {
    await updatePolicy(row.id, body);
    await loadRules();
  } catch (cause) {
    error.value = apiErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}

const confirmDelete = ref<Policy | null>(null);
const deleteError = ref<string | null>(null);

function askDelete(row: Policy): void {
  deleteError.value = null;
  confirmDelete.value = row;
}

async function remove(): Promise<void> {
  if (!confirmDelete.value || saving.value) return;
  saving.value = true;
  deleteError.value = null;
  try {
    await deletePolicy(confirmDelete.value.id);
    confirmDelete.value = null;
    await loadRules();
  } catch (cause) {
    deleteError.value = apiErrorMessage(cause);
  } finally {
    saving.value = false;
  }
}

function selectPolicy(row: Policy, choice: "inherit" | "allow" | "block"): void {
  if (choice === "inherit") askDelete(row);
  else void changeRule(row, {
    action: choice === "allow" ? "forward" : "deny", override_response: null
  });
}

watch([page, perPage], () => { void loadRules(); }, { immediate: true });
onMounted(() => { void loadTraffic(); });
</script>

<template>
  <div>
    <BlocklistTrafficChart
      :stats="stats"
      :loading="statsLoading"
      :error="statsError"
      result="overridden"
      title="Spoofed Traffic"
      class="mb-6"
    />

    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <h2 class="text-h6 text-sm-h5 spoofed-title">
        Spoofed Records
      </h2>
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        title="Refresh spoofed traffic and rules"
        aria-label="Refresh spoofed traffic and rules"
        :disabled="loading || statsLoading || saving"
        @click="refresh"
      />
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <v-sheet
      rounded="lg"
      color="#090c10"
    >
      <v-data-table-server
        v-model:page="page"
        v-model:items-per-page="perPage"
        :headers="headers"
        :items="items"
        :items-length="total"
        :loading="loading"
        :items-per-page-options="[10, 25, 50, 100]"
        density="compact"
        class="app-table"
        mobile-breakpoint="md"
        no-data-text="No spoof rules configured."
      >
        <template #item.policy="{ item }">
          <PolicyMenu
            choice="spoof"
            :spoof-value="item.override_response ?? ''"
            :saving="saving"
            @select="selectPolicy(item, $event)"
            @save-spoof="changeRule(item, { override_response: $event })"
          />
        </template>
        <template #item.enabled="{ item }">
          <v-switch
            :model-value="item.enabled"
            :aria-label="`Enable spoof rule for ${item.domain}`"
            :disabled="saving"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="changeRule(item, { enabled: $event === true })"
          />
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              title="Edit spoof rule"
              aria-label="Edit spoof rule"
              :disabled="saving"
              @click="openEditor(item)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              title="Delete spoof rule"
              aria-label="Delete spoof rule"
              :disabled="saving"
              @click="askDelete(item)"
            />
          </div>
        </template>
      </v-data-table-server>
    </v-sheet>

    <v-dialog
      v-model="dialog"
      max-width="560"
      :persistent="saving"
    >
      <v-card>
        <v-card-title>Edit spoof rule</v-card-title>
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
            v-model="form.client"
            label="Client (IP or *)"
            :disabled="saving"
          />
          <v-text-field
            v-model="form.domain"
            label="Domain (exact, *.suffix, or *)"
            :disabled="saving"
          />
          <v-text-field
            v-model="form.override_response"
            label="A / AAAA answers (comma-separated IPs)"
            :disabled="saving"
          />
          <v-text-field
            v-model.number="form.override_ttl"
            type="number"
            min="0"
            step="1"
            label="TTL (seconds)"
            :disabled="saving"
          />
          <v-textarea
            v-model="form.description"
            label="Description"
            rows="2"
            auto-grow
            :disabled="saving"
          />
          <v-switch
            v-model="form.enabled"
            label="Enabled"
            color="primary"
            :disabled="saving"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="saving"
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
      :persistent="saving"
      @update:model-value="confirmDelete = null"
    >
      <v-card>
        <v-card-title>Delete spoof rule</v-card-title>
        <v-card-text>
          <v-alert
            v-if="deleteError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ deleteError }}
          </v-alert>
          Delete the spoof rule for <strong>{{ confirmDelete?.client }}</strong> /
          <strong>{{ confirmDelete?.domain }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="saving"
            @click="confirmDelete = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="saving"
            @click="remove"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.spoofed-title {
  color: #b1b8c0;
}
</style>