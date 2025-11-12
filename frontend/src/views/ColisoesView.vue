<template>
  <div class="grid" style="grid-template-columns: 3fr 2fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Colisoes registradas</h3>
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
          Fase do voo
          <select v-model.number="filtros.fase">
            <option :value="undefined">Todas</option>
            <option v-for="fase in lookups.fases_voo" :key="fase.id" :value="fase.id">{{ fase.name }}</option>
          </select>
        </label>
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem colisoes" />
      </LoadingState>
    </div>
    <div class="card">
      <h3>Registrar colisao</h3>
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
          <input type="number" v-model.number="novo.location_id" placeholder="ID do local" required />
        </label>
        <label>
          Data
          <input type="date" v-model="novo.date_utc" required />
        </label>
        <label>
          Hora
          <input type="time" v-model="novo.time_local" required />
        </label>
        <label>
          Fase
          <select v-model.number="novo.phase_id">
            <option :value="undefined">Selecione</option>
            <option v-for="fase in lookups.fases_voo" :key="fase.id" :value="fase.id">{{ fase.name }}</option>
          </select>
        </label>
        <label>
          Gravidade
          <select v-model.number="novo.damage_id">
            <option :value="undefined">Sem dano</option>
            <option v-for="d in lookups.classes_dano" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
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
  { titulo: 'Fase', campo: 'phase_id' },
  { titulo: 'Dano', campo: 'damage_id' },
  { titulo: 'Notas', campo: 'notes' }
];

const filtros = ref<{ airportId?: number; fase?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ fases_voo: [], classes_dano: [] });
const carregando = ref(false);
const erro = ref<string | null>(null);
const novo = ref({
  airport_id: '' as any,
  location_id: '' as any,
  date_utc: '',
  time_local: '',
  phase_id: undefined as any,
  damage_id: undefined as any
});

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    lista.value = await ApiService.getColisoes(filtros.value);
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar colisoes';
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  try {
    await api.post('/api/colisoes', novo.value);
    carregar();
    novo.value = { airport_id: '' as any, location_id: '' as any, date_utc: '', time_local: '', phase_id: undefined as any, damage_id: undefined as any };
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
  flex-wrap: wrap;
  gap: 1rem;
}

.form {
  flex-direction: column;
}

select,
input,
textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}
</style>
