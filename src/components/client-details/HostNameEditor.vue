<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { findHostByIp, updateHostName } from "@/services/hosts";
import { apiErrorMessage } from "@/services/errors";

const props = defineProps<{ client: string }>();

const hostId = ref<number | null>(null);
const name = ref<string | null>(null);
const editing = ref(false);
const draft = ref("");
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);

const displayName = computed(() => name.value?.trim() || "UNKNOWN");

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  editing.value = false;
  try {
    const host = await findHostByIp(props.client);
    hostId.value = host?.id ?? null;
    name.value = host?.device_name ?? null;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

function startEdit(): void {
  draft.value = name.value ?? "";
  error.value = null;
  editing.value = true;
}

function cancel(): void {
  editing.value = false;
  error.value = null;
}

async function save(): Promise<void> {
  if (hostId.value === null || saving.value) return;
  const next = draft.value.trim() || null; // blank clears the name
  saving.value = true;
  error.value = null;
  try {
    name.value = (await updateHostName(hostId.value, next)).device_name;
    editing.value = false;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => props.client, load);
</script>

<template>
  <div class="hostname-editor">
    <div
      v-if="!editing"
      class="d-flex align-center flex-wrap ga-1"
    >
      <h2 class="text-h5 text-sm-h4 custom-heading mb-0">
        {{ displayName }}
      </h2>
      <v-btn
        icon="mdi-pencil"
        variant="text"
        size="small"
        :loading="loading"
        :disabled="loading || hostId === null"
        aria-label="Edit hostname"
        @click="startEdit"
      />
    </div>

    <div
      v-else
      class="d-flex align-center flex-wrap ga-1"
    >
      <v-text-field
        v-model="draft"
        density="compact"
        variant="outlined"
        hide-details
        autofocus
        placeholder="UNKNOWN"
        class="hostname-field"
        :disabled="saving"
        @keyup.enter="save"
        @keyup.esc="cancel"
      />
      <v-btn
        icon="mdi-check"
        variant="text"
        size="small"
        color="success"
        :loading="saving"
        aria-label="Save hostname"
        @click="save"
      />
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        :disabled="saving"
        aria-label="Cancel"
        @click="cancel"
      />
    </div>

    <div
      v-if="error"
      class="text-error text-caption mt-1"
    >
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
/* Size comes from Vuetify text utilities; this only styles appearance + wrap */
.custom-heading {
  text-transform: uppercase !important;
  font-weight: 500;
  color: #b1b8c0 !important;
  font-family: var(--app-font-family);
  word-break: break-word;
}

.hostname-field {
  max-width: 320px;
}
</style>
