<template>
  <form class="filtro" @submit.prevent="onSubmit">
    <label>
      Inicio
      <input type="date" v-model="local.inicio" />
    </label>
    <label>
      Fim
      <input type="date" v-model="local.fim" />
    </label>
    <button class="btn btn-primary" type="submit">Aplicar</button>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

const props = defineProps<{ inicio?: string; fim?: string }>();
const emit = defineEmits<{ (e: 'submit', value: { inicio?: string; fim?: string }): void }>();

const local = reactive({ inicio: props.inicio, fim: props.fim });

function onSubmit() {
  emit('submit', { inicio: local.inicio, fim: local.fim });
}
</script>

<style scoped>
.filtro {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  color: #475569;
}

input {
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}
</style>
