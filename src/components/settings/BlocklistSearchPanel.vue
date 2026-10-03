<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useBlocklistsStore } from "@/stores/blocklists";
import { searchBlocklistDomains } from "@/services/blocklists";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import type { BlocklistMatch, BlocklistOverride } from "@/types/domain";

const store = useBlocklistsStore();
const { overrides, overridesLoading, overridesError } = storeToRefs(store);

// Domain lookup: "is this domain on a blocklist, and which one?" (GET /blocklists/search).
const lookupQuery = ref("");
const lookupResults = ref<BlocklistMatch[]>([]);
const lookupLoading = ref(false);
const lookupError = ref<string | null>(null);
const lookupSearched = ref(false);

async function runLookup(): Promise<void> {
  const q = lookupQuery.value.trim();
  if (!q) return;
  lookupLoading.value = true;
  lookupError.value = null;
  try {
    const page = await searchBlocklistDomains(q, 100);
    lookupResults.value = page.items;
    lookupSearched.value = true;
  } catch (e) {
    lookupError.value = apiErrorMessage(e);
    lookupResults.value = [];
    lookupSearched.value = false;
  } finally {
    lookupLoading.value = false;
  }
}

// ---- Overrides (allowlist): domains stripped from blocklists at download time ----
const overrideHeaders = [
  { title: "Domain", key: "domain" },
  { title: "Added", key: "created_at" },
  { title: "", key: "actions", sortable: false, align: "end" as const }
];

// Shown after a mutation: overrides only apply once each blocklist is reloaded.
const overrideReloadNote = ref(false);

// Domains already allowlisted — lets the "Add to overrides" buttons reflect state.
const overrideDomainSet = computed(() => new Set(overrides.value.map((o) => o.domain)));

// Overrides are added from the lookup results (one in flight at a time).
const addingOverride = ref<string | null>(null);
const overrideActionError = ref<string | null>(null);

async function addToOverrides(domain: string): Promise<void> {
  if (!domain || addingOverride.value || overrideDomainSet.value.has(domain)) return;
  addingOverride.value = domain;
  overrideActionError.value = null;
  try {
    await store.addOverride(domain);
    overrideReloadNote.value = true;
  } catch (e) {
    overrideActionError.value = apiErrorMessage(e);
  } finally {
    addingOverride.value = null;
  }
}

const confirmDeleteOverride = ref<BlocklistOverride | null>(null);
const overrideDeleting = ref(false);

async function removeOverride(): Promise<void> {
  if (!confirmDeleteOverride.value) return;
  overrideDeleting.value = true;
  try {
    await store.removeOverride(confirmDeleteOverride.value.id);
    confirmDeleteOverride.value = null;
    overrideReloadNote.value = true;
  } finally {
    overrideDeleting.value = false;
  }
}

onMounted(() => {
  void store.loadOverrides();
});
</script>

<template>
  <div>
    <!-- Domain lookup: which blocklist (if any) contains a domain -->
    <v-card
      color="surface-card"
      class="pa-4 mb-4"
    >
      <div class="lookup-heading mb-1">
        Blocklist lookup
      </div>
      <div class="text-body-2 text-medium-emphasis mb-3">
        Type a domain (or part of one) to check whether it appears on any blocklist.
      </div>
      <div class="d-flex ga-2 align-center">
        <v-text-field
          v-model="lookupQuery"
          label="Domain or partial domain"
          prepend-inner-icon="mdi-magnify"
          density="compact"
          variant="outlined"
          hide-details
          :loading="lookupLoading"
          @keyup.enter="runLookup"
        />
        <v-btn
          color="primary"
          :loading="lookupLoading"
          :disabled="!lookupQuery.trim()"
          @click="runLookup"
        >
          Search
        </v-btn>
      </div>

      <v-alert
        v-if="lookupError"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-3"
      >
        {{ lookupError }}
      </v-alert>

      <div
        v-else-if="lookupSearched && lookupResults.length === 0"
        class="d-flex align-center ga-2 mt-3 text-success"
      >
        <v-icon size="18">
          mdi-check-circle
        </v-icon>
        <span>Not found on any blocklist.</span>
      </div>

      <div
        v-else-if="lookupResults.length"
        class="lookup-results mt-3"
      >
        <div class="text-caption text-medium-emphasis mb-2">
          {{ lookupResults.length }} match{{ lookupResults.length === 1 ? "" : "es" }}
        </div>
        <div
          v-for="m in lookupResults"
          :key="`${m.blocklist_id}:${m.domain}`"
          class="d-flex align-center ga-2 py-1"
        >
          <v-icon
            size="16"
            color="error"
          >
            mdi-cancel
          </v-icon>
          <span class="lookup-domain">{{ m.domain }}</span>
          <span class="text-medium-emphasis">on</span>
          <span class="lookup-source">{{ m.blocklist_name ?? `blocklist #${m.blocklist_id}` }}</span>
          <v-spacer />
          <v-btn
            v-if="overrideDomainSet.has(m.domain)"
            size="x-small"
            variant="tonal"
            color="success"
            prepend-icon="mdi-check"
            disabled
          >
            Overridden
          </v-btn>
          <v-btn
            v-else
            size="x-small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            :loading="addingOverride === m.domain"
            @click="addToOverrides(m.domain)"
          >
            Add to overrides
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- Overrides (allowlist): domains stripped from blocklists at download time -->
    <div class="mt-8 mb-2">
      <h3 class="text-subtitle-1 font-weight-medium">
        Blocklist overrides
      </h3>
      <p class="text-caption text-medium-emphasis mb-0">
        Domains listed here are excluded (allowlisted) from every blocklist. Add one from the
        blocklist lookup above.
      </p>
    </div>

    <v-alert
      v-if="overrideActionError"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="overrideActionError = null"
    >
      {{ overrideActionError }}
    </v-alert>

    <v-alert
      v-if="overrideReloadNote"
      type="info"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="overrideReloadNote = false"
    >
      A blocklist has to be reloaded for the blocklist override to take effect — use the refresh
      action on the Blocklists page.
    </v-alert>

    <AsyncState
      :loading="overridesLoading"
      :error="overridesError"
      :empty="overrides.length === 0"
      empty-text="No overrides configured."
    >
      <v-card color="surface-card">
        <v-data-table
          :headers="overrideHeaders"
          :items="overrides"
          density="comfortable"
          class="app-table"
          mobile-breakpoint="md"
        >
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              title="Remove override"
              @click="confirmDeleteOverride = item"
            />
          </template>
        </v-data-table>
      </v-card>
    </AsyncState>

    <v-dialog
      :model-value="confirmDeleteOverride !== null"
      max-width="440"
      @update:model-value="confirmDeleteOverride = null"
    >
      <v-card>
        <v-card-title>Remove override</v-card-title>
        <v-card-text>
          Remove <strong>{{ confirmDeleteOverride?.domain }}</strong> from the allowlist?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="confirmDeleteOverride = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="overrideDeleting"
            @click="removeOverride"
          >
            Remove
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.lookup-heading {
  font-size: 1.05rem;
  font-weight: 500;
  color: #b1b8c0;
}

.lookup-domain {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.85rem;
  color: #e6e9ee;
  overflow-wrap: anywhere;
}

.lookup-source {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: #8b949e;
  overflow-wrap: anywhere;
}
</style>
