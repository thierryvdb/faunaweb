<template>
  <div class="dashboard">
    <FiltroPeriodo :inicio="periodo.inicio" :fim="periodo.fim" @submit="atualizarPeriodo" />

    <LoadingState :carregando="carregando" :erro="erro">
      <div v-if="dados" class="grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
        <KpiCard
          v-for="item in dados.aeroportos"
          :key="item.airport_id"
          :subtitulo="item.nome"
          :valor="item.sr10k"
          sufixo="SR/10k"
          :descricao="`Strikes: ${item.strikes}`"
        />
      </div>
    </LoadingState>

    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
      <div class="card">
        <h3>Taxa com dano</h3>
        <ul>
          <li v-for="item in dados?.aeroportos" :key="item.airport_id">
            {{ item.nome }} : {{ item.pct_strikes_com_dano ?? 0}} %
          </li>
        </ul>
      </div>
      <div class="card">
        <h3>Top especies (pareto)</h3>
        <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
        <p v-else>Sem dados suficientes</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart, registerables } from 'chart.js';
import FiltroPeriodo from '@/components/FiltroPeriodo.vue';
import KpiCard from '@/components/KpiCard.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService } from '@/services/api';

Chart.register(...registerables);

const periodo = ref({ inicio: undefined as string | undefined, fim: undefined as string | undefined });
const dados = ref<any | null>(null);
const carregando = ref(false);
const erro = ref<string | null>(null);
const pareto = ref<{ especie: string; strikes: number }[]>([]);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const [kpis, paretoResp] = await Promise.all([
      ApiService.getKpisResumo(periodo.value),
      ApiService.getPareto(periodo.value)
    ]);
    dados.value = kpis;
    pareto.value = paretoResp.dados.slice(0, 5);
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao carregar o painel';
  } finally {
    carregando.value = false;
  }
}

function atualizarPeriodo(valor: { inicio?: string; fim?: string }) {
  periodo.value = valor;
  carregar();
}

const chartData = computed(() => {
  if (!pareto.value.length) return null;
  return {
    labels: pareto.value.map((item) => item.especie),
    datasets: [
      {
        label: 'Strikes',
        data: pareto.value.map((item) => item.strikes),
        backgroundColor: '#0ea5e9'
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  plugins: { legend: { display: false } }
};

onMounted(carregar);
</script>

<style scoped>
ul {
  list-style: none;
  padding-left: 0;
}

li {
  padding: 0.35rem 0;
  border-bottom: 1px solid #e2e8f0;
}
</style>
