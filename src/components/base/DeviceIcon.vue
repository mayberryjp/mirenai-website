<script setup lang="ts">
import { computed } from "vue";
import { useTheme } from "vuetify";

const props = withDefaults(
  defineProps<{
    // Device icon key (e.g. "TV"); null falls back to a generic monitor glyph.
    icon: string | null;
    size?: number | string;
    // Raw CSS color or a Vuetify theme color name (e.g. "primary").
    color?: string;
  }>(),
  { size: 24, color: "currentColor" }
);

const theme = useTheme();

const sizePx = computed(() =>
  typeof props.size === "number" ? `${props.size}px` : props.size
);

// Device SVGs are monochrome silhouettes, so tint them via a CSS mask. Resolve
// Vuetify theme names (e.g. "primary") to hex; pass raw CSS colors through.
const tint = computed(() => theme.current.value.colors[props.color] ?? props.color);

// Served from public/deviceicons/<icon>.svg (honours the Vite base path).
const iconUrl = computed(() =>
  props.icon ? `${import.meta.env.BASE_URL}deviceicons/${props.icon}.svg` : null
);
</script>

<template>
  <span
    v-if="iconUrl"
    class="device-icon"
    role="img"
    :style="{
      width: sizePx,
      height: sizePx,
      backgroundColor: tint,
      '--device-icon-url': `url('${iconUrl}')`
    }"
  />
  <v-icon
    v-else
    icon="mdi-monitor"
    :size="size"
    :color="color"
  />
</template>

<style scoped>
.device-icon {
  display: inline-block;
  -webkit-mask: var(--device-icon-url) center / contain no-repeat;
  mask: var(--device-icon-url) center / contain no-repeat;
}
</style>
