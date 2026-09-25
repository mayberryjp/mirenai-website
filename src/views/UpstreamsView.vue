<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { storeToRefs } from "pinia";
import { useUpstreamsStore } from "@/stores/upstreams";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import type { Upstream, UpstreamCreate, UpstreamProtocol } from "@/types/domain";

const store = useUpstreamsStore();
const { items, loading, error } = storeToRefs(store);

const protocols: UpstreamProtocol[] = ["udp", "tcp"];

const headers = [
  { title: "Priority", key: "priority" },
  { title: "Name", key: "name" },
  { title: "Address", key: "address" },
  { title: "Port", key: "port" },
  { title: "Protocol", key: "protocol" },
  { title: "Enabled", key: "enabled" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

interface UpstreamForm {
  name: string;
  address: string;
  port: number;
  protocol: UpstreamProtocol;
  enabled: boolean;
  priority: number;
}

function emptyForm(): UpstreamForm {
  return { name: "", address: "", port: 53, protocol: "udp", enabled: true, priority: 100 };
}

const dialog = ref(false);
const editingId = ref<number | null>(null);
const form = reactive<UpstreamForm>(emptyForm());
const formError = ref<string | null>(null);
const saving = ref(false);

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, emptyForm());
  formError.value = null;
  dialog.value = true;
}

function openEdit(row: Upstream): void {
  editingId.value = row.id;
  Object.assign(form, {
    name: row.name ?? "",
    address: row.address,
    port: row.port,
    protocol: row.protocol,
    enabled: row.enabled,
    priority: row.priority
  });
  formError.value = null;
  dialog.value = true;
}

async function submit(): Promise<void> {
  saving.value = true;
  formError.value = null;
  const body: UpstreamCreate = {
    address: form.address.trim(),
    name: form.name.trim() || null,
    port: form.port,
    protocol: form.protocol,
    enabled: form.enabled,
    priority: form.priority
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

const confirmDelete = ref<Upstream | null>(null);
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
        Upstreams
      </h1>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openCreate"
      >
        New upstream
      </v-btn>
    </div>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="items.length === 0"
      empty-text="No upstream resolvers."
    >
      <v-card variant="tonal">
        <v-data-table
          :headers="headers"
          :items="items"
          density="comfortable"
        >
          <template #item.name="{ item }">
            {{ item.name ?? "—" }}
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
        <v-card-title>{{ editingId === null ? "New upstream" : "Edit upstream" }}</v-card-title>
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
            label="Name (optional)"
          />
          <v-text-field
            v-model="form.address"
            label="Address (IP)"
          />
          <v-text-field
            v-model.number="form.port"
            type="number"
            label="Port"
          />
          <v-select
            v-model="form.protocol"
            :items="protocols"
            label="Protocol"
          />
          <v-text-field
            v-model.number="form.priority"
            type="number"
            label="Priority (lower = first)"
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
        <v-card-title>Delete upstream</v-card-title>
        <v-card-text>
          Delete upstream <strong>{{ confirmDelete?.address }}</strong>?
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
