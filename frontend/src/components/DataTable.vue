<template>
  <div class="table-wrapper card">
    <table>
      <thead>
        <tr>
          <th v-for="col in colunas" :key="col.campo">
            {{ col.titulo }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!dados?.length">
          <td :colspan="colunas.length" class="vazio">{{ vazio }}</td>
        </tr>
        <tr v-for="(linha, idx) in dados" :key="idx">
          <td v-for="col in colunas" :key="col.campo">
            <slot :name="col.campo" :valor="linha[col.campo]" :linha="linha">
              {{ formatar(linha[col.campo]) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ colunas: { titulo: string; campo: string }[]; dados: Record<string, any>[]; vazio?: string }>();

function formatar(valor: any) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR');
  if (valor instanceof Date) return valor.toLocaleDateString('pt-BR');
  return valor;
}

const vazio = props.vazio ?? 'Nenhum registro';
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  font-size: 0.85rem;
  text-transform: uppercase;
  color: #475569;
}

.vazio {
  text-align: center;
  padding: 2rem 0;
  color: #94a3b8;
}
</style>
