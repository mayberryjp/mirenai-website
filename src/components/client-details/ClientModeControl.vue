<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { getClientMode, setClientMode } from "@/services/clients";
import { apiErrorMessage } from "@/services/errors";
import type { ClientMode, SettableClientMode } from "@/types/domain";

const props = defineProps<{ client: string }>();

interface ModeOption {
  value: SettableClientMode;
  label: string;
  icon: string;
  desc: string;
}

const options: ModeOption[] = [
  { value: "default", label: "Default", icon: "mdi-cog-outline", desc: "Inherit the global default action." },
  { value: "forward", label: "Allow all", icon: "mdi-check-network-outline", desc: "Forward every query for this client." },
  { value: "blocklist", label: "Blocklist", icon: "mdi-shield-check-outline", desc: "Allow everything except blocklisted names." },
  { value: "deny", label: "Block all", icon: "mdi-cancel", desc: "Deny every query (NXDOMAIN)." }
];

const mode = ref<ClientMode | null>(null);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);

const currentDesc = computed(() => {
  if (mode.value === "override") {
    return "Advanced per-domain override — managed in Policies.";
  }
  return options.find((o) => o.value === mode.value)?.desc ?? "";
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    mode.value = (await getClientMode(props.client)).mode;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function choose(next: SettableClientMode): Promise<void> {
  if (saving.value || next === mode.value) return;
  const prev = mode.value;
  saving.value = true;
  error.value = null;
  mode.value = next; // optimistic
  try {
    mode.value = (await setClientMode(props.client, next)).mode;
  } catch (e) {
    mode.value = prev;
    error.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => props.client, load);
</script>

<template>
  <v-card color="surface-card">
    <v-card-title class="d-flex align-center px-4 py-3">
      <span class="text-subtitle-1 font-weight-medium">Response policy</span>
      <v-spacer />
      <v-progress-circular
        v-if="saving"
        indeterminate
        size="18"
        width="2"
        color="primary"
      />
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div
        v-if="loading"
        class="d-flex justify-center py-4"
      >
        <v-progress-circular
          indeterminate
          color="primary"
        />
      </div>
      <template v-else>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          closable
          @click:close="error = null"
        >
          {{ error }}
        </v-alert>
        <v-alert
          v-if="mode === 'override'"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          This client has an advanced per-domain override set in Policies. Choosing a mode below replaces its wildcard rule.
        </v-alert>

        <div class="mode-grid">
          <v-btn
            v-for="opt in options"
            :key="opt.value"
            :color="opt.value === mode ? 'primary' : undefined"
            :variant="opt.value === mode ? 'flat' : 'outlined'"
            :disabled="saving"
            class="mode-btn"
            @click="choose(opt.value)"
          >
            <v-icon start>
              {{ opt.icon }}
            </v-icon>
            {{ opt.label }}
          </v-btn>
        </div>

        <p class="text-caption text-medium-emphasis mt-3 mb-0">
          {{ currentDesc }}
        </p>
      </template>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.mode-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-btn {
  text-transform: none;
}
</style>
