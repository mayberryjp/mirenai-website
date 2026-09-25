<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { usePoliciesStore } from "@/stores/policies";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import type { Policy, PolicyAction, PolicyCreate } from "@/types/domain";

const store = usePoliciesStore();
const { items, loading, error } = storeToRefs(store);

const actions: PolicyAction[] = ["forward", "override", "deny", "blocklist"];

const headers = [
  { title: "Client", key: "client" },
  { title: "Domain", key: "domain" },
  { title: "Action", key: "action" },
  { title: "Override", key: "override_response" },
  { title: "Enabled", key: "enabled" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

interface PolicyForm {
  client: string;
  domain: string;
  action: PolicyAction;
  override_response: string;
  override_ttl: number;
  enabled: boolean;
  description: string;
}

function emptyForm(): PolicyForm {
  return {
    client: "",
    domain: "",
    action: "forward",
    override_response: "",
    override_ttl: 300,
    enabled: true,
    description: ""
  };
}

const dialog = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<PolicyForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

function openEdit(row: Policy): void {
  editingId.value = row.id;
  Object.assign(form, {
    client: row.client,
    domain: row.domain,
    action: row.action,
    override_response: row.override_response ?? "",
    override_ttl: row.override_ttl,
    enabled: row.enabled,
    description: row.description ?? ""
  });
  formError.value = null;
  dialog.value = true;
}

async function submit(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const body: PolicyCreate = {
    client: form.client.trim(),
    domain: form.domain.trim(),
    action: form.action,
    override_ttl: form.override_ttl,
    enabled: form.enabled,
    description: form.description.trim() || null,
    // Only send override_response when overriding (spec §7.2 cross-field rule).
    override_response: form.action === "override" ? form.override_response.trim() : null
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

const confirmDelete = ref<Policy | null>(null);
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

onMounted(() => {
  void store.load();
});
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5">
        Policies
      </h1>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New policy
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No policies defined."
    >
      <v-card variant="tonal">
        <v-data-table
          :headers="headers"
          :items="items"
          density="comfortable"
        >
          <template #item.override_response="{ item }">
            {{ item.override_response ?? "—" }}
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
        <v-card-title>{{ editingId === null ? "New policy" : "Edit policy" }}</v-card-title>
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
          />
          <v-text-field
            v-model="form.domain"
            label="Domain (exact, *.suffix, or *)"
          />
          <v-select
            v-model="form.action"
            :items="actions"
            label="Action"
          />
          <v-text-field
            v-if="form.action === 'override'"
            v-model="form.override_response"
            label="Override response (comma-separated IPs)"
          />
          <v-text-field
            v-model.number="form.override_ttl"
            type="number"
            label="Override TTL"
          />
          <v-textarea
            v-model="form.description"
            label="Description"
            rows="2"
            auto-grow
          />
          <v-switch
            v-model="form.enabled"
            label="Enabled"
            color="primary"
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
        <v-card-title>Delete policy</v-card-title>
        <v-card-text>
          Delete the policy for <strong>{{ confirmDelete?.client }}</strong> /
          <strong>{{ confirmDelete?.domain }}</strong>?
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
