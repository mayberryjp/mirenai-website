<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  createPolicy,
  deletePolicy,
  listPolicies,
  updatePolicy
} from "@/services/policies";
import { apiErrorMessage } from "@/services/errors";
import type { ClientMode, Policy, PolicyAction, QueryLog } from "@/types/domain";

const props = defineProps<{
  client: string;
  rows: QueryLog[];
  clientMode: ClientMode | null; // effective client-level action; inherited by domains
}>();

type Choice = "inherit" | "allow" | "block" | "spoof";

const choiceItems = [
  { title: "Inherit", value: "inherit" },
  { title: "Allow", value: "allow" },
  { title: "Block", value: "block" },
  { title: "Spoof", value: "spoof" }
];

const headers = [
  { title: "Domain", key: "domain" },
  { title: "Type", key: "qtype" },
  { title: "Count", key: "count" },
  { title: "Policy", key: "policy", sortable: false },
  { title: "Last Seen", key: "last_seen" },
  { title: "Override", key: "override", sortable: false }
];

const policies = ref<Policy[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const savingDomains = ref(new Set<string>());
// Per-row edit drafts, keyed by domain+qtype so editing one query type doesn't
// pull the other rows for the same domain into edit mode.
const choiceDrafts = reactive<Record<string, Choice>>({});
const spoofDrafts = reactive<Record<string, string>>({});

// Exact-domain policies for this client (the "*" row is the client-level mode).
const policyByDomain = computed(() => {
  const map = new Map<string, Policy>();
  for (const p of policies.value) {
    if (p.client === props.client && p.domain !== "*") map.set(p.domain, p);
  }
  return map;
});

function policyFor(domain: string): Policy | undefined {
  return policyByDomain.value.get(domain);
}

function actionLabel(action: string | null): string {
  switch (action) {
    case "forward":
      return "Allow";
    case "deny":
      return "Policy Denied";
    case "override":
      return "Spoof";
    case "blocklist":
      return "Blocklist Denied";
    case "default":
      return "Default";
    default:
      return "—";
  }
}

// Chip color per action so the policy reads at a glance.
function actionColor(action: string | null): string {
  switch (action) {
    case "deny":
      return "error"; // Policy Denied — red
    case "override":
      return "warning"; // Spoof — orange
    case "blocklist":
      return "burgundy"; // Blocklist Denied — deep red
    default:
      return "grey"; // Allow / Default / none
  }
}

function effectiveLabel(domain: string): string {
  const p = policyFor(domain);
  return actionLabel(p ? p.action : props.clientMode);
}

function effectiveColor(domain: string): string {
  const p = policyFor(domain);
  return actionColor(p ? p.action : props.clientMode);
}

function isConfigured(domain: string): boolean {
  return policyByDomain.value.has(domain);
}

function choiceFor(domain: string): Choice {
  const p = policyFor(domain);
  if (!p) return "inherit";
  if (p.action === "forward") return "allow";
  if (p.action === "deny") return "block";
  if (p.action === "override") return "spoof";
  return "inherit";
}

// Draft key: policies are per-domain, but the table has one row per (domain,
// qtype), so drafts are tracked per row to keep their edit state independent.
function rowKey(item: QueryLog): string {
  return `${item.domain}|${item.qtype}`;
}

function selectedChoice(item: QueryLog): Choice {
  return choiceDrafts[rowKey(item)] ?? choiceFor(item.domain);
}

function spoofResponse(item: QueryLog): string {
  return spoofDrafts[rowKey(item)] ?? policyFor(item.domain)?.override_response ?? "";
}

function isSaving(domain: string): boolean {
  return savingDomains.value.has(domain);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const page = await listPolicies();
    policies.value = page.items;
  } catch (e) {
    error.value = apiErrorMessage(e);
    policies.value = [];
  } finally {
    loading.value = false;
  }
}

function setSaving(domain: string, on: boolean): void {
  const next = new Set(savingDomains.value);
  if (on) next.add(domain);
  else next.delete(domain);
  savingDomains.value = next;
}

function onChoice(item: QueryLog, choice: Choice): void {
  const key = rowKey(item);
  choiceDrafts[key] = choice;
  if (choice === "spoof") {
    if (spoofDrafts[key] === undefined) {
      spoofDrafts[key] = policyFor(item.domain)?.override_response ?? "";
    }
    return; // wait for the response value + explicit save
  }
  void apply(item.domain, choice);
}

async function apply(domain: string, choice: Choice, response?: string): Promise<void> {
  if (isSaving(domain)) return;
  setSaving(domain, true);
  error.value = null;
  const existing = policyFor(domain);
  try {
    if (choice === "inherit") {
      if (existing) {
        await deletePolicy(existing.id);
        policies.value = policies.value.filter((p) => p.id !== existing.id);
      }
    } else {
      const action: PolicyAction =
        choice === "allow" ? "forward" : choice === "block" ? "deny" : "override";
      const body = {
        client: props.client,
        domain,
        action,
        override_response: choice === "spoof" ? (response ?? "").trim() : null
      };
      const saved = existing
        ? await updatePolicy(existing.id, body)
        : await createPolicy(body);
      const idx = policies.value.findIndex((p) => p.id === saved.id);
      if (idx >= 0) policies.value.splice(idx, 1, saved);
      else policies.value.push(saved);
    }
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    setSaving(domain, false);
  }
}

watch(
  () => props.client,
  () => {
    for (const k of Object.keys(choiceDrafts)) delete choiceDrafts[k];
    for (const k of Object.keys(spoofDrafts)) delete spoofDrafts[k];
    void load();
  },
  { immediate: true }
);
</script>

<template>
  <v-sheet
    rounded="lg"
    color="#090c10"
  >
    <v-card-title class="text-h6 text-sm-h5 text-md-h4 policy-title d-flex align-center px-4 py-3">
      Domain Queries &amp; Policy Override
    </v-card-title>
    <v-divider />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="ma-3"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <v-data-table
      :headers="headers"
      :items="rows"
      :loading="loading"
      density="compact"
      class="app-table"
      mobile-breakpoint="md"
      :items-per-page="25"
    >
      <template #item.count="{ item }">
        {{ item.count.toLocaleString() }}
      </template>

      <template #item.policy="{ item }">
        <div class="d-flex align-center ga-2">
          <v-chip
            size="small"
            variant="tonal"
            :color="effectiveColor(item.domain)"
          >
            {{ effectiveLabel(item.domain) }}
          </v-chip>
          <v-chip
            size="x-small"
            variant="tonal"
            :color="isConfigured(item.domain) ? 'primary' : undefined"
          >
            {{ isConfigured(item.domain) ? "configured" : "inherited" }}
          </v-chip>
        </div>
      </template>

      <template #item.override="{ item }">
        <div class="d-flex align-center ga-2 override-cell">
          <v-select
            :model-value="selectedChoice(item)"
            :items="choiceItems"
            density="compact"
            variant="outlined"
            hide-details
            class="choice-select"
            :disabled="isSaving(item.domain)"
            @update:model-value="(v: Choice) => onChoice(item, v)"
          />
          <template v-if="selectedChoice(item) === 'spoof'">
            <v-text-field
              :model-value="spoofResponse(item)"
              density="compact"
              variant="outlined"
              hide-details
              placeholder="Response (IP / name)"
              class="spoof-input"
              :disabled="isSaving(item.domain)"
              @update:model-value="(v: string) => (spoofDrafts[rowKey(item)] = v)"
              @keyup.enter="apply(item.domain, 'spoof', spoofResponse(item))"
            />
            <v-btn
              icon="mdi-check"
              size="small"
              variant="text"
              color="success"
              :loading="isSaving(item.domain)"
              aria-label="Save spoof response"
              @click="apply(item.domain, 'spoof', spoofResponse(item))"
            />
          </template>
        </div>
      </template>

      <template #item.last_seen="{ item }">
        <span class="date-column">{{ item.last_seen }}</span>
      </template>
    </v-data-table>
  </v-sheet>
</template>

<style scoped>
.policy-title {
  color: #b1b8c0;
}

.choice-select {
  min-width: 120px;
  max-width: 140px;
}

.spoof-input {
  min-width: 160px;
  max-width: 220px;
}

.override-cell {
  padding: 4px 0;
}
</style>
