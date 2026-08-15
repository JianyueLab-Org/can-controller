<script setup lang="ts" generic="T extends object">
import EmptyState from "@/components/ui/EmptyState.vue";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  class?: string;
}

withDefaults(
  defineProps<{
    columns: Column[];
    /**
     * Rows keep their own type. This used to be `Record<string, unknown>[]`,
     * which erased the row type at every `#cell-*` slot — so each call site
     * cast `row` back to its real shape by hand, dozens of times, and those
     * casts were never checked (astro check does not diagnose .vue files).
     */
    rows: T[];
    rowKey: keyof T & string;
    loading?: boolean;
    /**
     * Placeholder rows drawn while `loading`. The default is a guess at a
     * short page; set it nearer the real count when you know it, so the table
     * does not visibly grow or shrink as the data lands.
     */
    loadingRows?: number;
    /** Announced while loading; falls back to "Loading". */
    loadingLabel?: string;
    empty?: string;
    /** Secondary line under the empty title. */
    emptyDescription?: string;
    /** Tighter row padding for dense admin tables. */
    dense?: boolean;
  }>(),
  {
    loading: false,
    loadingRows: 5,
    empty: "No data",
    dense: false,
  },
);

function alignClass(align?: string): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

// A column list is data, so its `key` is a plain string that `T` cannot
// express. The one cast that needs is contained here rather than at each of
// the ~40 call sites.
function cellValue(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
</script>

<template>
  <div>
    <div
      v-if="$slots['header-actions']"
      class="mb-4 flex flex-wrap items-center justify-between gap-3"
    >
      <slot name="header-actions" />
    </div>

    <!-- The placeholder rows below are aria-hidden, so this is what a screen
         reader hears while they are on screen. -->
    <p v-if="loading" role="status" class="sr-only">
      {{ loadingLabel || "Loading" }}
    </p>

    <!-- `data-table` drives the below-sm card layout in globals.css. -->
    <div class="overflow-x-auto">
      <table class="data-table min-w-full" :aria-busy="loading || undefined">
        <thead>
          <tr class="border-b border-subtle">
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :class="[
                'whitespace-nowrap bg-surface-sunken px-4 text-xs font-semibold uppercase tracking-wider text-muted first:rounded-l-control last:rounded-r-control',
                dense ? 'py-2' : 'py-2.5',
                alignClass(col.align),
                col.class,
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Placeholder rows, not a spinner in a spanning cell: the columns
               are already known, so the table can hold its real shape and the
               rows swap in without the layout jumping. They are real `<tr>`s
               carrying `data-label`, so the below-sm card layout in
               globals.css labels them exactly as it labels loaded rows. -->
          <template v-if="loading">
            <tr
              v-for="i in loadingRows"
              :key="`loading-${i}`"
              aria-hidden="true"
              class="border-b border-subtle last:border-0"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                :data-label="col.label"
                :class="['px-4', dense ? 'py-2.5' : 'py-3.5']"
              >
                <div class="skeleton h-4 w-full max-w-32"></div>
              </td>
            </tr>
          </template>
          <tr v-else-if="!rows.length" class="dt-row-span">
            <td :colspan="columns.length" class="px-4">
              <slot name="empty">
                <EmptyState :title="empty" :description="emptyDescription" />
              </slot>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            v-else
            :key="String(row[rowKey])"
            class="border-b border-subtle transition-colors last:border-0 hover:bg-surface-sunken"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              :data-label="col.label"
              :class="[
                'whitespace-nowrap px-4 text-sm text-ink',
                dense ? 'py-2.5' : 'py-3.5',
                alignClass(col.align),
                col.class,
              ]"
            >
              <slot
                :name="`cell-${col.key}`"
                :row="row"
                :value="cellValue(row, col.key)"
              >
                {{ cellValue(row, col.key) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
