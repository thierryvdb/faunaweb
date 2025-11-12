<template>
  <div class="grid" style="grid-template-columns: 3fr 2fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Acoes de controle</h3>
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
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem acoes" />
      </LoadingState>
    </div>
    <div class="stack">
      <div class="card">
        <h3>Registrar acao</h3>
        <form class="form" @submit.prevent="salvar">
          <label>
            Aeroporto
            <select v-model.number="nova.airport_id" required>
              <option value="" disabled>Selecione</option>
              <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </label>
          <label>
            Data
            <input type="date" v-model="nova.date_utc" required />
          </label>
          <label>
            Tipo
            <select v-model.number="nova.action_type_id">
              <option :value="undefined">Selecione</option>
              <option v-for="t in lookups.tipos_acao" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label>
            Duracao (min)
            <input type="number" v-model.number="nova.duration_min" min="0" />
          </label>
          <button class="btn btn-primary" type="submit">Salvar</button>
        </form>
      </div>
      <div class="card">
        <h3>Avaliacao rapida (BA espacial)</h3>
        <form class="form" @submit.prevent="rodarBa">
          <label>
            ID da acao
            <input type="number" v-model.number="metrica.action_id" required />
          </label>
          <label>
            Raio (m)
            <input type="number" v-model.number="metrica.raio_m" min="50" />
          </label>
          <label>
            Janela (dias)
            <input type="number" v-model.number="metrica.janela_dias" min="7" />
          </label>
          <button class="btn btn-secondary" type="submit">Calcular</button>
        </form>
        <div v-if="resultadoBa" class="resultado">
          <p><strong>SR pre:</strong> {{ resultadoBa.sr10k_pre ?? '—' }}</p>
          <p><strong>SR pos:</strong> {{ resultadoBa.sr10k_pos ?? '—' }}</p>
          <p><strong>RR:</strong> {{ resultadoBa.rr ?? '—' }}</p>
        </div>
      </div>
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
  { titulo: 'Tipo', campo: 'action_type_id' },
  { titulo: 'Duracao', campo: 'duration_min' },
  { titulo: 'Observacoes', campo: 'result_notes' }
];

const filtros = ref<{ airportId?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ tipos_acao: [] });
const carregando = ref(false);
const erro = ref<string | null>(null);
const nova = ref({ airport_id: '' as any, date_utc: '', action_type_id: undefined as any, duration_min: 0 });
const metrica = ref({ action_id: undefined as any, raio_m: 500, janela_dias: 30 });
const resultadoBa = ref<any | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    lista.value = await ApiService.getAcoes(filtros.value);
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar acoes';
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  try {
    await api.post('/api/acoes-controle', nova.value);
    carregar();
    nova.value = { airport_id: '' as any, date_utc: '', action_type_id: undefined as any, duration_min: 0 };
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

async function rodarBa() {
  try {
    const { data } = await api.post('/api/kpis/ba-espacial', metrica.value);
    resultadoBa.value = data;
  } catch (e: any) {
    alert(e?.message ?? 'Falha ao calcular');
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

.select,
input {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.resultado {
  margin-top: 1rem;
  background: #f1f5f9;
  padding: 1rem;
  border-radius: 8px;
}
</style>
