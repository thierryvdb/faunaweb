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
          <input type="date" v-model="filtros.inicio" />
        </label>
        <label>
          Fim
          <input type="date" v-model="filtros.fim" />
        </label>
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem avistamentos" />
      </LoadingState>
    </div>
    <div class="card">
      <h3>Registrar avistamento</h3>
      <form class="form" @submit.prevent="salvar">
        <label>
          Aeroporto
          <select v-model.number="novo.airport_id" required @change="carregarLocais">
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
          <input type="date" v-model="novo.date_utc" required />
        </label>
        <label>
          Hora local
          <input type="time" v-model="novo.time_local" required />
        </label>
        <label>
          Equipe
          <input type="text" v-model="novo.observer_team" />
        </label>
        <label>
          Notas
          <textarea v-model="novo.notes" rows="3"></textarea>
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
  { titulo: 'Hora', campo: 'time_local' },
  { titulo: 'Local', campo: 'location_id' },
  { titulo: 'Equipe', campo: 'observer_team' },
  { titulo: 'Notas', campo: 'notes' }
];

const filtros = ref<{ airportId?: number; inicio?: string; fim?: string }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const locais = ref<any[]>([]);
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

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    lista.value = await ApiService.getAvistamentos(filtros.value);
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar avistamentos';
  } finally {
    carregando.value = false;
  }
}

async function carregarLocais() {
  if (!novo.value.airport_id) return;
  const { data } = await api.get(`/api/aeroportos/${novo.value.airport_id}/locais`);
  locais.value = data;
}

async function salvar() {
  try {
    await api.post('/api/avistamentos', novo.value);
    carregar();
    novo.value = { airport_id: '' as any, location_id: '' as any, date_utc: '', time_local: '', observer_team: '', notes: '' };
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

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
