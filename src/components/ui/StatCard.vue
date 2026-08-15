<script setup lang="ts">
import { computed } from "vue";
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    icon?: string;
    accent?: "info" | "success" | "warning" | "danger" | "neutral";
    /** Small caption under the value (counts, units, freshness). */
    hint?: string;
    /** Renders the whole tile as a link. */
    href?: string;
  }>(),
  {
    accent: "info",
  },
);

const accentClass = computed(
  () =>
    ({
      success: "badge-success",
      warning: "badge-warning",
      danger: "badge-danger",
      neutral: "badge-neutral",
      info: "badge-info",
    })[props.accent],
);
</script>

<template>
  <component
    :is="href ? 'a' : 'div'"
    :href="href"
    :class="[
      'card flex items-start gap-3 p-4 sm:gap-4 sm:p-5',
      href
        ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover'
        : '',
    ]"
  >
    <span
      v-if="icon"
      :class="[
        'flex size-9 shrink-0 items-center justify-center rounded-control sm:size-10',
        accentClass,
      ]"
    >
      <Icon :name="icon" class="size-4.5 sm:size-5" />
    </span>
    <div class="min-w-0 flex-1">
      <!-- Wraps on a phone, where two tiles sit side by side and a label like
           "Longest flight" would otherwise be truncated to nothing. -->
      <p class="text-sm font-medium leading-snug text-muted sm:truncate">
        {{ label }}
      </p>
      <p
        class="tnum mt-1 truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl"
      >
        {{ value }}
      </p>
      <p v-if="hint" class="mt-0.5 truncate text-xs text-faint">{{ hint }}</p>
    </div>
    <Icon v-if="href" name="arrowTopRight" class="size-4 shrink-0 text-faint" />
  </component>
</template>
