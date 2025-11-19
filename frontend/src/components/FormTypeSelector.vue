<template>
  <div class="form-selector">
    <label>
      Formulário escolhido
      <select :value="modelValue" @change="onChange">
        <option v-for="template in templates" :key="template.id" :value="template.id">
          {{ template.selectorTitle }}
        </option>
      </select>
    </label>
    <p class="selector-description">
      {{ currentTemplate.frequency }} | {{ currentTemplate.purpose }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import { inspectionTemplates, InspectionTemplate } from '@/constants/inspectionTemplates';

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  items: {
    type: Array as PropType<InspectionTemplate[]>,
    default: () => inspectionTemplates
  }
});

const emits = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const templates = computed(() => {
  return props.items && props.items.length ? props.items : inspectionTemplates;
});

const currentTemplate = computed(() => {
  return templates.value.find((template) => template.id === props.modelValue) || templates.value[0];
});

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emits('update:modelValue', value);
}
</script>

<style scoped>
.form-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 20px;
}

.form-selector select {
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.selector-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}
</style>
