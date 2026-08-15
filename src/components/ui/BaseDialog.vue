<script setup lang="ts">
/**
 * The modal dialog, shell included.
 *
 * Every centred overlay in the app had been hand-rolled from the same twenty
 * lines: a fixed backdrop, a `left-1/2 top-1/2 -translate-*` panel, a header
 * with a truncating title and an icon-only close button, a scrolling body and
 * a bordered footer. There were seven copies, three of them on the activity
 * management screen alone, and they had already drifted — 85 vs 88 dvh, 92 vs
 * 95 vw, and an `aria-label` on the wrapper where a real `aria-labelledby`
 * pointing at the visible heading belonged. This is that shell, once. Do not
 * hand-roll another, the way `BaseToggle` is the switch.
 *
 * The behaviour comes from `useOverlay` — Escape, the body scroll lock, the
 * focus trap, and returning focus to whatever opened it. Two details are why
 * this is a component rather than a snippet to copy:
 *
 * - **It can be mounted already open.** `useOverlay` wires itself from a
 *   *watcher*, so an overlay whose ref is `true` on its first render never
 *   gets any of it. `ActivityBriefing` knew that and opened itself in
 *   `onMounted`; a call site that did not would silently lose the trap. The
 *   internal `visible` ref does that dance here, so `:open="true"` on a
 *   freshly mounted dialog is safe.
 * - **`aria-labelledby` is wired to the rendered heading**, so the title
 *   cannot be announced as one thing and shown as another.
 *
 * Usage:
 *   <BaseDialog v-model:open="open" :title="t('edit')" :close-label="t('close')">
 *     …body…
 *     <template #footer>…</template>
 *   </BaseDialog>
 */
import { computed, onMounted, ref, useId, watch } from "vue";
import { useOverlay } from "@/lib/useOverlay";
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    /** One line under the title. */
    description?: string;
    size?: "sm" | "md" | "lg";
    /** Accessible name for the × button — required for a real one. */
    closeLabel: string;
    /**
     * Set false for a dialog that must be answered rather than dismissed.
     * Escape and the backdrop stop closing it; the × button goes away.
     */
    dismissible?: boolean;
    /** `none` for a body that draws its own full-bleed rows (tabs, lists). */
    bodyPadding?: "none" | "md";
  }>(),
  { size: "md", dismissible: true, bodyPadding: "md" },
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();

/**
 * The ref `useOverlay` actually watches. It deliberately lags `props.open` by
 * a tick on mount — see the note above — and is what Escape and the backdrop
 * write to, so every dismissal path leaves through one place.
 */
const visible = ref(false);
const panel = useOverlay(visible);

const headingId = useId();

const widthClass = computed(
  () => ({ sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" })[props.size],
);

watch(
  () => props.open,
  (open) => {
    visible.value = open;
  },
);

// Mounted open: assigning after the first render is what gives the watcher in
// `useOverlay` an edge to fire on.
onMounted(() => {
  if (props.open) visible.value = true;
});

// Escape and the backdrop write to `visible`; tell the parent, once, and only
// when it is the one still holding the dialog open.
watch(visible, (open) => {
  if (!open && props.open) {
    emit("update:open", false);
    emit("close");
  }
});

function dismiss() {
  if (props.dismissible) visible.value = false;
}
</script>

<template>
  <div
    v-if="visible"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="headingId"
  >
    <div
      class="animate-overlay-in fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm"
      @click="dismiss"
    ></div>
    <div
      ref="panel"
      tabindex="-1"
      :class="[
        'animate-panel-in-centered fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card border border-subtle bg-surface shadow-popover',
        widthClass,
      ]"
    >
      <div
        class="flex items-start justify-between gap-3 border-b border-subtle p-5"
      >
        <div class="min-w-0">
          <h2 :id="headingId" class="truncate text-base font-semibold text-ink">
            <slot name="title">{{ title }}</slot>
          </h2>
          <p v-if="description" class="mt-0.5 text-sm text-muted">
            {{ description }}
          </p>
        </div>
        <button
          v-if="dismissible"
          type="button"
          :aria-label="closeLabel"
          class="-mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-sunken hover:text-ink"
          @click="dismiss"
        >
          <Icon name="xMark" class="size-5" />
        </button>
      </div>

      <!-- Chrome that must stay put while the body scrolls — a tab bar, a
           search field. Full-bleed: it draws its own padding and rule. -->
      <div v-if="$slots.toolbar" class="shrink-0">
        <slot name="toolbar" />
      </div>

      <div
        :class="[
          'flex-1 overflow-y-auto overscroll-contain',
          bodyPadding === 'none' ? '' : 'p-5',
        ]"
      >
        <slot />
      </div>

      <div
        v-if="$slots.footer"
        class="flex flex-wrap items-center justify-end gap-2.5 border-t border-subtle p-5"
      >
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
