<script setup lang="ts">
import { computed, ref } from "vue";
import { usePoliciesStore } from "@/stores/policies";
import { apiErrorMessage } from "@/services/errors";
import PolicyMenu from "@/components/base/PolicyMenu.vue";
import type { PolicyAction } from "@/types/domain";

// Inline per-(client, domain) policy selector, matching the client detail
// table's override control: Inherit / Allow / Block / Spoof (+ spoof response).
const props = defineProps<{
  client: string;
  domain: string;
}>();

type Choice = "inherit" | "allow" | "block" | "spoof";

const store = usePoliciesStore();

const saving = ref(false);
const error = ref<string | null>(null);

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

const selectedChoice = computed<Choice>(() => choiceFromAction(existing.value?.action));

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
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="d-flex align-center ga-2 policy-control">
    <PolicyMenu
      :choice="selectedChoice"
      :spoof-value="existing?.override_response ?? ''"
      :saving="saving"
      @select="(c) => apply(c)"
      @save-spoof="(v) => apply('spoof', v)"
    />
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
.policy-control {
  padding: 4px 0;
}
</style>
