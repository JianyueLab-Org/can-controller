<script setup lang="ts">
/**
 * Shared "nothing here yet" block for empty tables, lists and panels, so a
 * blank result reads as a deliberate state rather than a broken page.
 */
import Icon from "@/components/ui/Icon.vue";

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** ICON_PATHS key; defaults to a tray. */
    icon?: string;
    compact?: boolean;
  }>(),
  { icon: "inbox", compact: false },
);
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center justify-center text-center',
      compact ? 'gap-2 py-8' : 'gap-3 py-14',
    ]"
  >
    <span
      class="flex size-12 items-center justify-center rounded-full bg-surface-sunken text-faint"
    >
      <Icon :name="icon" class="size-6" />
    </span>
    <p class="text-sm font-semibold text-ink">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-muted">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-1">
      <slot name="action" />
    </div>
  </div>
</template>
