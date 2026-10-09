<script setup lang="ts">
import { computed, ref, watch } from "vue";

type Choice = "inherit" | "allow" | "block" | "spoof";

const props = defineProps<{
  choice: Choice;
  spoofValue: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  select: [choice: Exclude<Choice, "spoof">];
  saveSpoof: [value: string];
}>();

const choiceItems: { title: string; value: Choice }[] = [
  { title: "Inherit", value: "inherit" },
  { title: "Allow", value: "allow" },
  { title: "Block", value: "block" },
  { title: "Spoof", value: "spoof" }
];

const open = ref(false);
const editingSpoof = ref(false);
const draft = ref("");

const label = computed(() => {
  if (props.choice === "spoof" && props.spoofValue) return `Spoof → ${props.spoofValue}`;
  return choiceItems.find((c) => c.value === props.choice)?.title ?? "Inherit";
});

watch(open, (isOpen) => {
  editingSpoof.value = isOpen && props.choice === "spoof";
  if (isOpen) draft.value = props.spoofValue;
});

function onPick(value: Choice): void {
  if (value === "spoof") {
    editingSpoof.value = true;
    draft.value = props.spoofValue;
    return;
  }
  open.value = false;
  emit("select", value);
}

function save(): void {
  const value = draft.value.trim();
  if (!value) return;
  open.value = false;
  emit("saveSpoof", value);
}
</script>

<template>
  <v-menu
    v-model="open"
    :close-on-content-click="false"
    location="bottom start"
  >
    <template #activator="{ props: activator }">
      <v-btn
        v-bind="activator"
        size="small"
        variant="outlined"
        append-icon="mdi-menu-down"
        class="policy-btn text-none"
        :loading="saving"
        :disabled="saving"
      >
        <span class="policy-btn-label">{{ label }}</span>
      </v-btn>
    </template>

    <v-card min-width="220">
      <v-list density="compact">
        <v-list-item
          v-for="item in choiceItems"
          :key="item.value"
          :title="item.title"
          :active="item.value === choice"
          @click="onPick(item.value)"
        />
      </v-list>
      <div
        v-if="editingSpoof"
        class="d-flex align-center ga-2 px-3 pb-3"
      >
        <v-text-field
          v-model="draft"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          placeholder="Response (IP / name)"
          @keyup.enter="save"
        />
        <v-btn
          icon="mdi-check"
          size="small"
          variant="text"
          color="success"
          :disabled="!draft.trim()"
          aria-label="Save spoof response"
          @click="save"
        />
      </div>
    </v-card>
  </v-menu>
</template>

<style scoped>
.policy-btn {
  max-width: 220px;
}

.policy-btn-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
