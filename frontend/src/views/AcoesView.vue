<template>
  <div class="grid" style="grid-template-columns: 3fr 2fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Ações de controle</h3>
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
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem ações">
          <template #date_br="{ valor }">{{ valor ?? '-' }}</template>
          <template #tipo_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div class="stack">
      <div class="card">
        <header class="cabecalho">
          <h3>{{ editandoId ? 'Editar ação' : 'Registrar ação' }}</h3>
          <button v-if="editandoId" class="btn btn-secondary" type="button" @click="cancelarEdicao">Cancelar</button>
        </header>
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
            <input type="date" lang="pt-BR" v-model="nova.date_utc" required />
          </label>
          <label>
            Tipo
            <select v-model.number="nova.action_type_id">
              <option :value="undefined">Selecione</option>
              <option v-for="t in lookups.tipos_acao" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <label>
            Duração (min)
            <input type="number" v-model.number="nova.duration_min" min="0" />
          </label>
          <label>
            Observações
            <textarea rows="2" v-model="nova.result_notes"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">{{ editandoId ? 'Atualizar' : 'Salvar' }}</button>
        </form>
      </div>
      <div class="card">
        <h3>Avaliação rápida (BA espacial)</h3>
        <form class="form" @submit.prevent="rodarBa">
          <label>
            ID da ação
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
          <p><strong>SR pré:</strong> {{ resultadoBa.sr10k_pre ?? '-' }}</p>
          <p><strong>SR pós:</strong> {{ resultadoBa.sr10k_pos ?? '-' }}</p>
          <p><strong>RR:</strong> {{ resultadoBa.rr ?? '-' }}</p>
        </div>
      </div>
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
  { titulo: 'Duração', campo: 'duration_min' },
  { titulo: 'Observações', campo: 'result_notes' },
  { titulo: 'Ações', campo: 'acoes' }
];

const filtros = ref<{ airportId?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ tipos_acao: [] });
const carregando = ref(false);
const erro = ref<string | null>(null);
const nova = ref({ airport_id: '' as any, date_utc: '', action_type_id: undefined as any, duration_min: 0, result_notes: '' });
const metrica = ref({ action_id: undefined as any, raio_m: 500, janela_dias: 30 });
const resultadoBa = ref<any | null>(null);
const editandoId = ref<number | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getAcoes(filtros.value);
    lista.value = dados.map((acao: any) => ({
      ...acao,
      date_br: acao.date_utc ? new Date(acao.date_utc).toLocaleDateString('pt-BR') : null,
      tipo_nome: lookups.value.tipos_acao.find((t: any) => t.id === acao.action_type_id)?.name ?? '-'
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar ações';
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  try {
    if (editandoId.value) {
      await api.put(`/api/acoes-controle/${editandoId.value}`, nova.value);
    } else {
      await api.post('/api/acoes-controle', nova.value);
    }
    await carregar();
    cancelarEdicao();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function cancelarEdicao() {
  editandoId.value = null;
  nova.value = { airport_id: '' as any, date_utc: '', action_type_id: undefined as any, duration_min: 0, result_notes: '' };
}

function editar(acao: any) {
  editandoId.value = acao.id;
  nova.value = {
    airport_id: acao.airport_id,
    date_utc: acao.date_utc ? acao.date_utc.slice(0, 10) : '',
    action_type_id: acao.action_type_id,
    duration_min: acao.duration_min ?? 0,
    result_notes: acao.result_notes ?? ''
  } as any;
}

async function rodarBa() {
  try {
    const { data } = await api.post('/api/kpis/ba-espacial', metrica.value);
    resultadoBa.value = data;
  } catch (e: any) {
    alert(e?.message ?? 'Falha ao calcular');
  }
}

watch(
  () => nova.value.airport_id,
  async () => {
    if (nova.value.airport_id) {
      try {
        const user = ApiService.getUser<any>();
        if (user?.aeroporto_id && user.aeroporto_id !== nova.value.airport_id) {
          await ApiService.switchAirport(Number(nova.value.airport_id));
        }
      } catch {}
    }
  }
);

onMounted(async () => {
  try {
    const cad = await ApiService.getCadastros();
    aeroportos.value = cad.aeroportos ?? [];
    lookups.value = cad.lookups ?? { tipos_acao: [] };
    const user = ApiService.getUser<any>();
    if (user?.aeroporto_id) {
      nova.value.airport_id = user.aeroporto_id;
      filtros.value.airportId = user.aeroporto_id;
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
