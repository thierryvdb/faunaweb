<template>
  <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
    <div>
      <div class="card">
        <header class="cabecalho">
          <h3>Movimentos registrados</h3>
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
          <DataTable :colunas="colunas" :dados="lista" vazio="Nenhum movimento" />
        </LoadingState>
      </div>
    </div>
    <div class="card">
      <h3>Novo movimento</h3>
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
          <select v-model="novo.movement_type">
            <option value="Pouso">Pouso</option>
            <option value="Decolagem">Decolagem</option>
          </select>
        </label>
        <label>
          Quantidade no dia
          <input type="number" v-model.number="novo.movements_in_day" min="0" />
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
  { titulo: 'Tipo', campo: 'movement_type' },
  { titulo: 'Pista', campo: 'runway' },
  { titulo: 'Movimentos/dia', campo: 'movements_in_day' }
];

const filtros = ref<{ airportId?: number; inicio?: string; fim?: string }>({});
const lista = ref<any[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);
const aeroportos = ref<any[]>([]);
const novo = ref({ airport_id: '' as any, date_utc: '', movement_type: 'Pouso', movements_in_day: 0 });

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getMovimentos(filtros.value);
    lista.value = dados.map((mov: any) => ({
      ...mov,
      date_br: formatarData(mov.date_utc)
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar movimentos';
  } finally {
    carregando.value = false;
  }
}

function formatarData(valor?: string | null) {
  if (!valor) return null;
  const somenteData = valor.split('T')[0];
  const data = new Date(`${somenteData}T00:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data);
}

async function salvar() {
  try {
    await api.post('/api/movimentos', novo.value);
    carregar();
    novo.value = { airport_id: '' as any, date_utc: '', movement_type: 'Pouso', movements_in_day: 0 };
  } catch (e: any) {
    alert(e?.message ?? 'Nao foi possivel salvar');
  }
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
    const user = ApiService.getUser<any>();
    if (user?.aeroporto_id) {
      novo.value.airport_id = user.aeroporto_id;
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

.filtros {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

select,
input {
  padding: 0.4rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
