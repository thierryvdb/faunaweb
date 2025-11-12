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
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem atrativos">
          <template #date_br="{ valor }">{{ valor ?? '-' }}</template>
          <template #tipo_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div class="card">
      <header class="cabecalho">
        <h3>{{ editandoId ? 'Editar atrativo' : 'Novo registro' }}</h3>
        <button v-if="editandoId" class="btn btn-secondary" type="button" @click="cancelarEdicao">Cancelar</button>
      </header>
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
          <input type="date" lang="pt-BR" v-model="novo.date_utc" required />
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
          Descrição
          <textarea v-model="novo.description" rows="3"></textarea>
        </label>
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import DataTable from '@/components/DataTable.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService, api } from '@/services/api';

const colunas = [
  { titulo: 'Data', campo: 'date_br' },
  { titulo: 'Tipo', campo: 'tipo_nome' },
  { titulo: 'Status', campo: 'status' },
  { titulo: 'Descrição', campo: 'description' },
  { titulo: 'Ações', campo: 'acoes' }
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
const editandoId = ref<number | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getAtrativos(filtros.value);
    lista.value = dados.map((atr: any) => ({
      ...atr,
      date_br: atr.date_utc ? new Date(atr.date_utc).toLocaleDateString('pt-BR') : null,
      tipo_nome: lookups.value.tipos_atrativo.find((t: any) => t.id === atr.attractor_type_id)?.name ?? '-'
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar atrativos';
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  try {
    if (editandoId.value) {
      await api.put(`/api/atrativos/${editandoId.value}`, novo.value);
    } else {
      await api.post('/api/atrativos', novo.value);
    }
    await carregar();
    cancelarEdicao();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function cancelarEdicao() {
  editandoId.value = null;
  novo.value = { airport_id: '' as any, date_utc: '', attractor_type_id: undefined as any, status: 'ativo', description: '' };
}

function editar(atr: any) {
  editandoId.value = atr.id;
  novo.value = {
    airport_id: atr.airport_id,
    date_utc: atr.date_utc ? atr.date_utc.slice(0, 10) : '',
    attractor_type_id: atr.attractor_type_id,
    status: atr.status,
    description: atr.description ?? ''
  } as any;
}

watch(
  () => novo.value.airport_id,
  async () => {
    if (novo.value.airport_id) {
      try {
        const user = ApiService.getUser<any>();
        if (user?.aeroporto_id && user.aeroporto_id !== novo.value.airport_id) {
          await ApiService.switchAirport(Number(novo.value.airport_id));
        }
      } catch {}
    }
  }
);

onMounted(async () => {
  try {
    const cad = await ApiService.getCadastros();
    aeroportos.value = cad.aeroportos ?? [];
    lookups.value = cad.lookups ?? { tipos_atrativo: [] };
    const user = ApiService.getUser<any>();
    if (user?.aeroporto_id) {
      novo.value.airport_id = user.aeroporto_id;
    }
    await carregar();
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao carregar dados';
  }
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
