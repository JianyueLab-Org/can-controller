<script setup lang="ts">
/**
 * Accessible on/off switch, label included.
 *
 * Six hand-rolled copies of this markup used to sit in SuperRoster, each
 * hardcoding `bg-gray-200` for the off track — which in dark mode rendered a
 * pale pill on a dark card and read as *on*. Each also carried a bare
 * `<label>` with no `for`, so the text named nothing to a screen reader, and
 * `focus:outline-none` + `ring-offset-2` with no offset colour, which punched
 * a white halo around the switch in dark mode.
 *
 * The label lives here rather than at the call site so the association can't
 * be forgotten again.
 */
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    description?: string;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

defineEmits<{ "update:modelValue": [boolean] }>();

// useId (Vue 3.5+) is stable across the SSR render and hydration; a random id
// would differ between the two and desync `aria-labelledby`.
const labelId = useId();

const trackClass = computed(() => [
  "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
  // --border-strong swaps with the theme, so the off state stays legibly
  // "off" on both a white card and a #151c25 one.
  props.modelValue ? "bg-airwaysn" : "bg-[var(--border-strong)]",
  props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
]);
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <span v-if="label || description" class="min-w-0">
      <span :id="labelId" class="block text-sm font-medium text-ink">
        {{ label }}
      </span>
      <span v-if="description" class="mt-0.5 block text-sm text-muted">
        {{ description }}
      </span>
    </span>
    <button
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-labelledby="label ? labelId : undefined"
      :disabled="disabled"
      :class="trackClass"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span
        :class="[
          'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          modelValue ? 'translate-x-5' : 'translate-x-0',
        ]"
      />
    </button>
  </div>
</template>
