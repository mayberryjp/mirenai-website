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
    // When true, overlay a red diagonal slash to mark the client as blocked.
    blocked?: boolean;
  }>(),
  { size: 24, color: "currentColor", blocked: false }
);

const theme = useTheme();

const sizePx = computed(() =>
  typeof props.size === "number" ? `${props.size}px` : props.size
);

// Scale the slash thickness with the icon so it reads at any size (~2px @ 24).
const slashThickness = computed(() => {
  const n = typeof props.size === "number" ? props.size : parseFloat(props.size);
  return `${Number.isFinite(n) ? Math.max(2, Math.round(n / 12)) : 2}px`;
});

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
    class="device-icon-wrap"
    :class="{ 'is-blocked': blocked }"
    :style="{ '--slash-thickness': slashThickness }"
  >
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
  </span>
</template>

<style scoped>
.device-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.device-icon {
  display: inline-block;
  -webkit-mask: var(--device-icon-url) center / contain no-repeat;
  mask: var(--device-icon-url) center / contain no-repeat;
}

/* Red diagonal slash ("\") clipped to the icon box to flag a blocked client. */
.device-icon-wrap.is-blocked::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 150%;
  height: var(--slash-thickness, 2px);
  background-color: #ff3b30;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
  border-radius: 2px;
  transform: translate(-50%, -50%) rotate(45deg);
  pointer-events: none;
}
</style>
