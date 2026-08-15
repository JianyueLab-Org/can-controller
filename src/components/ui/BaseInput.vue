<script setup lang="ts">
import { computed, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    type?: string;
    label?: string;
    placeholder?: string;
    name?: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    autocomplete?: string;
    error?: string;
    /** Helper text below the field; hidden while `error` is set. */
    hint?: string;
    minlength?: number;
    maxlength?: number;
  }>(),
  {
    type: "text",
    required: false,
    disabled: false,
  },
);

defineEmits<{ (e: "update:modelValue", value: string): void }>();

const slots = useSlots();

// Fall back to name for the id so the <label for> stays wired even when the
// caller only supplies one. Both controlled (v-model) and uncontrolled
// (FormData via `name`) usage are supported.
const inputId = computed(() => props.id ?? props.name);
const hasLeading = computed(() => !!slots.leadingIcon);
const hasTrailing = computed(() => !!slots.trailingIcon);
const describedBy = computed(() => {
  if (!inputId.value) return undefined;
  if (props.error) return `${inputId.value}-error`;
  if (props.hint) return `${inputId.value}-hint`;
  return undefined;
});
</script>

<template>
  <div>
    <label
      v-if="label"
      :for="inputId"
      class="block text-sm font-medium text-ink"
    >
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <div :class="['relative', label ? 'mt-1.5' : '']">
      <span
        v-if="hasLeading"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint"
      >
        <slot name="leadingIcon" />
      </span>
      <input
        :id="inputId"
        :name="name"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :minlength="minlength"
        :maxlength="maxlength"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        :class="[
          'input',
          hasLeading ? 'pl-10' : '',
          hasTrailing ? 'pr-10' : '',
          error ? 'input-error' : '',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ]"
        @input="
          $emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
      <span
        v-if="hasTrailing"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-faint"
      >
        <slot name="trailingIcon" />
      </span>
    </div>
    <p
      v-if="error"
      :id="inputId ? `${inputId}-error` : undefined"
      class="mt-1.5 text-sm text-danger"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      :id="inputId ? `${inputId}-hint` : undefined"
      class="mt-1.5 text-sm text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
