<template>
  <div class="loading" v-if="carregando">Carregando...</div>
  <div class="erro" v-else-if="erro">{{ erro }}</div>
  <slot v-else />
</template>

<script setup lang="ts">
defineProps<{ carregando: boolean; erro: string | null }>();
</script>

<style scoped>
.loading,
.erro {
  padding: 1rem;
  border-radius: 8px;
}

.loading {
  background: #e0f2fe;
  color: #0369a1;
}

.erro {
  background: #fee2e2;
  color: #b91c1c;
}
</style>
