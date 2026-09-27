<script setup lang="ts">
import { computed, ref } from "vue";
import { usePoliciesStore } from "@/stores/policies";
import { apiErrorMessage } from "@/services/errors";
import type { PolicyAction } from "@/types/domain";

// Inline per-(client, domain) policy selector, matching the client detail
// table's override control: Inherit / Allow / Block / Spoof (+ spoof response).
const props = defineProps<{
  client: string;
  domain: string;
}>();

type Choice = "inherit" | "allow" | "block" | "spoof";

const choiceItems = [
  { title: "Inherit", value: "inherit" },
  { title: "Allow", value: "allow" },
  { title: "Block", value: "block" },
  { title: "Spoof", value: "spoof" }
];

const store = usePoliciesStore();

const saving = ref(false);
const error = ref<string | null>(null);
// Local edit drafts; null means "read from the store's current policy".
const choiceDraft = ref<Choice | null>(null);
const spoofDraft = ref<string | null>(null);

const existing = computed(() => store.policyFor(props.client, props.domain));

function choiceFromAction(action: PolicyAction | undefined): Choice {
  switch (action) {
    case "forward":
      return "allow";
    case "deny":
      return "block";
    case "override":
      return "spoof";
    default:
      return "inherit";
  }
}

const selectedChoice = computed<Choice>(
  () => choiceDraft.value ?? choiceFromAction(existing.value?.action)
);

const spoofResponse = computed<string>(
  () => spoofDraft.value ?? existing.value?.override_response ?? ""
);

function onChoice(choice: Choice): void {
  choiceDraft.value = choice;
  if (choice === "spoof") {
    if (spoofDraft.value === null) {
      spoofDraft.value = existing.value?.override_response ?? "";
    }
    return; // wait for the response value + explicit save
  }
  void apply(choice);
}

async function apply(choice: Choice, response?: string): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  error.value = null;
  const current = existing.value;
  try {
    if (choice === "inherit") {
      if (current) await store.remove(current.id);
    } else {
      const action: PolicyAction =
        choice === "allow" ? "forward" : choice === "block" ? "deny" : "override";
      const body = {
        client: props.client,
        domain: props.domain,
        action,
        override_response: choice === "spoof" ? (response ?? "").trim() : null
      };
      if (current) await store.update(current.id, body);
      else await store.create(body);
    }
    // Drafts cleared so the store becomes the source of truth again.
    choiceDraft.value = null;
    spoofDraft.value = null;
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="d-flex align-center ga-2 policy-control">
    <v-select
      :model-value="selectedChoice"
      :items="choiceItems"
      density="compact"
      variant="outlined"
      hide-details
      class="choice-select"
      :disabled="saving"
      @update:model-value="(v: Choice) => onChoice(v)"
    />
    <template v-if="selectedChoice === 'spoof'">
      <v-text-field
        :model-value="spoofResponse"
        density="compact"
        variant="outlined"
        hide-details
        placeholder="Response (IP / name)"
        class="spoof-input"
        :disabled="saving"
        @update:model-value="(v: string) => (spoofDraft = v)"
        @keyup.enter="apply('spoof', spoofResponse)"
      />
      <v-btn
        icon="mdi-check"
        size="small"
        variant="text"
        color="success"
        :loading="saving"
        aria-label="Save spoof response"
        @click="apply('spoof', spoofResponse)"
      />
    </template>
    <v-tooltip
      v-if="error"
      :text="error"
      location="top"
    >
      <template #activator="{ props: tip }">
        <v-icon
          v-bind="tip"
          color="error"
          size="small"
          icon="mdi-alert-circle"
        />
      </template>
    </v-tooltip>
  </div>
</template>

<style scoped>
.choice-select {
  min-width: 120px;
  max-width: 140px;
}

.spoof-input {
  min-width: 160px;
  max-width: 220px;
}

.policy-control {
  padding: 4px 0;
}
</style>
