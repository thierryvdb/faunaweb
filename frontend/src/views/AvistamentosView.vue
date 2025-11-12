<template>
  <div class="grid" style="grid-template-columns: 3fr 2fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Avistamentos recentes</h3>
        <button class="btn btn-secondary" @click="carregar">Atualizar</button>
      </header>
      <div class="filtros">
        <label>
          Aeroporto
          <select v-model.number="filtros.airportId">
            <option :value="undefined">Todos</option>
            <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>
          Inicio
          <input type="date" lang="pt-BR" v-model="filtros.inicio" />
        </label>
        <label>
          Fim
          <input type="date" lang="pt-BR" v-model="filtros.fim" />
        </label>
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem avistamentos">
          <template #location_nome="{ linha }">
            {{ linha.location_nome || linha.location_id }}
          </template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div class="card">
      <header class="cabecalho">
        <h3>{{ editandoId ? 'Editar avistamento' : 'Registrar avistamento' }}</h3>
        <button v-if="editandoId" class="btn btn-secondary" @click="cancelarEdicao">Cancelar</button>
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
          Local
          <select v-model.number="novo.location_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="l in locais" :key="l.id" :value="l.id">{{ l.code }}</option>
          </select>
        </label>
        <label>
          Data
          <input type="date" lang="pt-BR" v-model="novo.date_utc" required />
        </label>
        <label>
          Hora local
          <input type="time" v-model="novo.time_local" required />
        </label>
        <label>
          Equipe
          <select v-model="equipeSelecionada">
            <option value="">Selecione</option>
            <option v-for="eq in equipes" :key="eq.id" :value="eq.id">{{ eq.name }}</option>
          </select>
        </label>
        <label>
          Notas
          <textarea v-model="novo.notes" rows="3"></textarea>
        </label>
        <button class="btn btn-primary" type="submit">{{ editandoId ? 'Atualizar' : 'Salvar' }}</button>
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
  { titulo: 'Hora', campo: 'time_local' },
  { titulo: 'Local', campo: 'location_nome' },
  { titulo: 'Equipe', campo: 'observer_team' },
  { titulo: 'Notas', campo: 'notes' },
  { titulo: 'Ações', campo: 'acoes' }
];

const filtros = ref<{ airportId?: number; inicio?: string; fim?: string }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const locais = ref<any[]>([]);
const equipes = ref<any[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);
const novo = ref({
  airport_id: '' as any,
  location_id: '' as any,
  date_utc: '',
  time_local: '',
  observer_team: '',
  notes: ''
});
const equipeSelecionada = ref<string | number>('');
const editandoId = ref<number | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getAvistamentos(filtros.value);
    lista.value = dados.map((item: any) => ({
      ...item,
      date_br: item.date_utc ? new Date(item.date_utc).toLocaleDateString('pt-BR') : null
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar avistamentos';
  } finally {
    carregando.value = false;
  }
}

async function carregarLocaisEquipes() {
  if (!novo.value.airport_id) {
    locais.value = [];
    equipes.value = [];
    equipeSelecionada.value = '';
    return;
  }
  locais.value = await ApiService.getLocaisPorAeroporto(novo.value.airport_id);
  equipes.value = await ApiService.getEquipesPorAeroporto(novo.value.airport_id);
  if (novo.value.observer_team) {
    const match = equipes.value.find((eq: any) => eq.name === novo.value.observer_team);
    equipeSelecionada.value = match ? match.id : '';
  } else {
    equipeSelecionada.value = '';
  }
}

async function salvar() {
  try {
    if (equipeSelecionada.value) {
      const selecionada = equipes.value.find((eq: any) => eq.id === equipeSelecionada.value);
      novo.value.observer_team = selecionada?.name ?? '';
    } else {
      novo.value.observer_team = '';
    }
    if (editandoId.value) {
      await api.put(`/api/avistamentos/${editandoId.value}`, novo.value);
    } else {
      await api.post('/api/avistamentos', novo.value);
    }
    carregar();
    cancelarEdicao();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function cancelarEdicao() {
  editandoId.value = null;
  novo.value = { airport_id: '' as any, location_id: '' as any, date_utc: '', time_local: '', observer_team: '', notes: '' };
  equipeSelecionada.value = '';
  locais.value = [];
  equipes.value = [];
}

async function editar(avistamento: any) {
  editandoId.value = avistamento.id;
  novo.value = {
    airport_id: avistamento.airport_id,
    location_id: avistamento.location_id,
    date_utc: avistamento.date_utc?.slice(0, 10) ?? '',
    time_local: avistamento.time_local ?? '',
    observer_team: avistamento.observer_team ?? '',
    notes: avistamento.notes ?? ''
  } as any;
  await carregarLocaisEquipes();
  const match = equipes.value.find((eq: any) => eq.name === avistamento.observer_team);
  equipeSelecionada.value = match ? match.id : '';
}

watch(
  () => novo.value.airport_id,
  () => {
    carregarLocaisEquipes();
  }
);

onMounted(async () => {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos;
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
  flex-wrap: wrap;
  gap: 1rem;
}

.form {
  flex-direction: column;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

select,
input,
textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}
</style>
