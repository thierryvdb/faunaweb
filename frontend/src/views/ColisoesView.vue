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
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem colisoes">
          <template #date_br="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #location_nome="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #fase_nome="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #dano_nome="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div class="card">
      <header class="cabecalho">
        <h3>{{ editandoId ? 'Editar colisao' : 'Registrar colisao' }}</h3>
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
        <label>
          Notas
          <textarea rows="2" v-model="novo.notes"></textarea>
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
  { titulo: 'Fase', campo: 'fase_nome' },
  { titulo: 'Dano', campo: 'dano_nome' },
  { titulo: 'Notas', campo: 'notes' },
  { titulo: 'Ações', campo: 'acoes' }
];

const filtros = ref<{ airportId?: number; fase?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ fases_voo: [], classes_dano: [] });
const locais = ref<any[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);
const novo = ref({
  airport_id: '' as any,
  location_id: '' as any,
  date_utc: '',
  time_local: '',
  phase_id: undefined as any,
  damage_id: undefined as any,
  notes: ''
});
const editandoId = ref<number | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getColisoes(filtros.value);
    lista.value = dados.map((item: any) => ({
      ...item,
      date_br: item.date_utc ? new Date(item.date_utc).toLocaleDateString('pt-BR') : null,
      fase_nome: lookups.value.fases_voo.find((f: any) => f.id === item.phase_id)?.name ?? null,
      dano_nome: lookups.value.classes_dano.find((d: any) => d.id === item.damage_id)?.name ?? null
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar colisoes';
  } finally {
    carregando.value = false;
  }
}

async function carregarLocais() {
  if (!novo.value.airport_id) {
    locais.value = [];
    return;
  }
  locais.value = await ApiService.getLocaisPorAeroporto(novo.value.airport_id);
}

async function salvar() {
  try {
    if (editandoId.value) {
      await api.put(`/api/colisoes/${editandoId.value}`, novo.value);
    } else {
      await api.post('/api/colisoes', novo.value);
    }
    await carregar();
    cancelarEdicao();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function cancelarEdicao() {
  editandoId.value = null;
  novo.value = { airport_id: '' as any, location_id: '' as any, date_utc: '', time_local: '', phase_id: undefined as any, damage_id: undefined as any, notes: '' };
  locais.value = [];
}

async function editar(registro: any) {
  editandoId.value = registro.id;
  novo.value = {
    airport_id: registro.airport_id,
    location_id: registro.location_id,
    date_utc: registro.date_utc?.slice(0, 10) ?? '',
    time_local: registro.time_local ?? '',
    phase_id: registro.phase_id,
    damage_id: registro.damage_id,
    notes: registro.notes ?? ''
  } as any;
  await carregarLocais();
}

watch(
  () => novo.value.airport_id,
  () => {
    carregarLocais();
  }
);

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
