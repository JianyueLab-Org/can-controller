<script setup lang="ts">
import { computed } from "vue";
import Icon from "@/components/ui/Icon.vue";

interface Option {
  value: string | number;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    options: Option[];
    label?: string;
    name?: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  {
    required: false,
    disabled: false,
  },
);

defineEmits<{ (e: "update:modelValue", value: string): void }>();

const selectId = computed(() => props.id ?? props.name);
</script>

<template>
  <div>
    <label
      v-if="label"
      :for="selectId"
      class="block text-sm font-medium text-ink"
    >
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <div :class="['relative', label ? 'mt-1.5' : '']">
      <select
        :id="selectId"
        :name="name"
        :value="modelValue"
        :required="required"
        :disabled="disabled"
        :class="[
          'input cursor-pointer appearance-none pr-9',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ]"
        @change="
          $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
        "
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <Icon
        name="chevronUpDown"
        class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint"
      />
    </div>
  </div>
</template>
