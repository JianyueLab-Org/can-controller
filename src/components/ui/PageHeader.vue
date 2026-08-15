<script setup lang="ts">
/**
 * One page header for every panel page — title, optional eyebrow and
 * description, plus an `actions` slot that stays right-aligned on desktop
 * and wraps underneath on mobile. Replaces the slightly different h1/p
 * blocks each page used to hand-roll.
 */
import Icon from "@/components/ui/Icon.vue";

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** Small uppercase label above the title. */
    eyebrow?: string;
    /** ICON_PATHS key rendered in a brand tile beside the title. */
    icon?: string;
    /** Adds the bottom rule used on list/table pages. */
    divided?: boolean;
    /** Drops the bottom margin, for parents that already space their children. */
    flush?: boolean;
  }>(),
  { divided: false, flush: false },
);
</script>

<template>
  <div
    :class="[
      'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
      flush ? '' : 'mb-8',
      divided ? 'border-b border-subtle pb-6' : '',
    ]"
  >
    <div class="flex min-w-0 items-start gap-4">
      <span
        v-if="icon"
        class="hidden size-11 shrink-0 items-center justify-center rounded-card bg-info-bg text-info-fg sm:flex"
      >
        <Icon :name="icon" class="size-6" />
      </span>
      <div class="min-w-0">
        <p
          v-if="eyebrow"
          class="mb-1 text-xs font-semibold uppercase tracking-widest text-airwaysn"
        >
          {{ eyebrow }}
        </p>
        <h1 class="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          <slot name="title">{{ title }}</slot>
        </h1>
        <p v-if="description || $slots.description" class="mt-2 text-muted">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="flex shrink-0 flex-wrap items-center gap-3"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
