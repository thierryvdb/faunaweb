<template>
  <div class="kpi-card">
    <small>{{ subtitulo }}</small>
    <strong>{{ valorFormatado }}</strong>
    <span v-if="descricao">{{ descricao }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ subtitulo: string; valor: number | null | undefined; sufixo?: string; descricao?: string }>();

const valorFormatado = computed(() => {
  if (props.valor === null || props.valor === undefined) return '--';
  return props.sufixo ? `${props.valor} ${props.sufixo}` : String(props.valor);
});
</script>

<style scoped>
.kpi-card {
  background: #0ea5e9;
  color: #fff;
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 160px;
}

small {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
}

strong {
  font-size: 1.8rem;
}
</style>
