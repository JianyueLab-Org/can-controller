<script setup lang="ts">
/**
 * The single spinner for the whole app — replaces the hand-rolled
 * `animate-spin rounded-full border-b-2` blocks that were duplicated across
 * eight components at four different sizes.
 *
 * **Reach for `Skeleton` first.** A spinner is right only where there is no
 * shape to hold: inside a `BaseButton`, which keeps its own size, and inline in
 * a one-line status ("verifying your email…"). For a region — a table, a card
 * grid, a panel — a placeholder in the shape of the content beats a dot,
 * because it holds the layout instead of collapsing it and then snapping back.
 * `centered` is what the ~18 page-level loading states used to use and now do
 * not; it survives for a block genuinely too small or too irregular to sketch.
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg";
    label?: string;
    /** Render as a centred block with generous padding. */
    centered?: boolean;
  }>(),
  { size: "md", centered: false },
);

const sizeClass = computed(
  () => ({ sm: "size-4", md: "size-6", lg: "size-10" })[props.size],
);
</script>

<template>
  <div
    :class="
      centered
        ? 'flex min-h-64 w-full flex-col items-center justify-center gap-3 py-12'
        : 'inline-flex items-center gap-2'
    "
    role="status"
    :aria-label="label || 'Loading'"
  >
    <svg
      :class="[sizeClass, 'animate-spin text-airwaysn']"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        class="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      />
      <path
        class="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V1C5.9 1 1 5.9 1 12h3z"
      />
    </svg>
    <span v-if="label" class="text-sm text-muted">{{ label }}</span>
  </div>
</template>
