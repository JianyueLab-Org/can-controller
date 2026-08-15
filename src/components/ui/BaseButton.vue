<script setup lang="ts">
import { computed } from "vue";
import Spinner from "@/components/ui/Spinner.vue";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "soft" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    as?: "button" | "a";
    href?: string;
    /** Square button with no label — pass the glyph in the `icon` slot. */
    iconOnly?: boolean;
  }>(),
  {
    variant: "primary",
    size: "md",
    type: "button",
    disabled: false,
    loading: false,
    block: false,
    as: "button",
    iconOnly: false,
  },
);

const sizeClass = computed(() => {
  if (props.iconOnly) {
    return { sm: "size-8 p-0", md: "size-9 p-0", lg: "size-11 p-0" }[
      props.size
    ];
  }
  switch (props.size) {
    case "sm":
      return "px-3 py-1.5 text-xs gap-1.5";
    case "lg":
      return "px-6 py-3 text-base gap-2";
    default:
      return "px-4 py-2 text-sm gap-2";
  }
});

const classes = computed(() => [
  "btn",
  `btn-${props.variant}`,
  sizeClass.value,
  props.block ? "w-full" : "",
]);

const isDisabled = computed(() => props.disabled || props.loading);
const spinnerSize = computed(() => (props.size === "lg" ? "md" : "sm"));
</script>

<template>
  <a
    v-if="as === 'a'"
    :href="isDisabled ? undefined : href"
    :class="[classes, isDisabled ? 'pointer-events-none' : '']"
    :aria-disabled="isDisabled || undefined"
  >
    <Spinner v-if="loading" :size="spinnerSize" />
    <slot v-else name="icon" />
    <slot />
    <slot name="trailing" />
  </a>
  <button v-else :type="type" :disabled="isDisabled" :class="classes">
    <Spinner v-if="loading" :size="spinnerSize" />
    <slot v-else name="icon" />
    <slot />
    <slot name="trailing" />
  </button>
</template>
