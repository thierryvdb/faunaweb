<template>
  <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Atrativos no entorno</h3>
        <button class="btn btn-secondary" @click="carregar">Atualizar</button>
      </header>
      <div class="filtros">
        <label>
          Status
          <select v-model="filtros.status">
            <option value="">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="mitigando">Mitigando</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </label>
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem atrativos" />
      </LoadingState>
    </div>
    <div class="card">
      <h3>Novo registro</h3>
      <form class="form" @submit.prevent="salvar">
        <label>
          Aeroporto
          <select v-model.number="novo.airport_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>
          Data
          <input type="date" v-model="novo.date_utc" required />
        </label>
        <label>
          Tipo
          <select v-model.number="novo.attractor_type_id">
            <option :value="undefined">Selecione</option>
            <option v-for="t in lookups.tipos_atrativo" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label>
          Status
          <select v-model="novo.status">
            <option value="ativo">Ativo</option>
            <option value="mitigando">Mitigando</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </label>
        <label>
          Descricao
          <textarea v-model="novo.description" rows="3"></textarea>
        </label>
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from '@/components/DataTable.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService, api } from '@/services/api';

const colunas = [
  { titulo: 'Data', campo: 'date_utc' },
  { titulo: 'Tipo', campo: 'attractor_type_id' },
  { titulo: 'Status', campo: 'status' },
  { titulo: 'Descricao', campo: 'description' }
];

const filtros = ref<{ status?: string }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ tipos_atrativo: [] });
const carregando = ref(false);
const erro = ref<string | null>(null);
const novo = ref({
  airport_id: '' as any,
  date_utc: '',
  attractor_type_id: undefined as any,
  status: 'ativo',
  description: ''
});

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    lista.value = await ApiService.getAtrativos(filtros.value);
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar atrativos';
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  try {
    await api.post('/api/atrativos', novo.value);
    carregar();
    novo.value = { airport_id: '' as any, date_utc: '', attractor_type_id: undefined as any, status: 'ativo', description: '' };
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

onMounted(async () => {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos;
  lookups.value = cad.lookups;
  carregar();
});
</script>

<style scoped>
.cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filtros,
.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

select,
input,
textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}
</style>
