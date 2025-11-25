<template>
  <div class="dashboard">
    <FiltroPeriodo :inicio="periodo.inicio" :fim="periodo.fim" @submit="atualizarPeriodo" />

    <section v-if="painelCards.length" class="grid metric-grid">
      <div v-for="card in painelCards" :key="card.titulo" class="card metric-card">
        <header class="metric-card__header">
          <div>
            <h3>{{ card.titulo }}</h3>
            <p v-if="card.descricao">{{ card.descricao }}</p>
          </div>
          <span v-if="card.destaque" class="metric-card__value">{{ card.destaque }}</span>
        </header>
        <dl>
          <div v-for="item in card.metricas" :key="item.label" class="metric-line">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.valor }}</dd>
          </div>
        </dl>
      </div>
    </section>

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
const painelResumo = ref<any | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const [kpis, paretoResp, resumoResp] = await Promise.all([
      ApiService.getKpisResumo(periodo.value),
      ApiService.getPareto(periodo.value),
      ApiService.getPainelResumo(periodo.value)
    ]);
    dados.value = kpis;
    pareto.value = paretoResp.dados.slice(0, 5);
    painelResumo.value = resumoResp;
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao carregar o painel';
    painelResumo.value = null;
  } finally {
    carregando.value = false;
  }
}

function atualizarPeriodo(valor: { inicio?: string; fim?: string }) {
  periodo.value = { inicio: valor.inicio, fim: valor.fim };
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

function formatNumero(valor: number | null | undefined, casas = 0) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(valor);
}

function formatPercent(valor: number | null | undefined, casas = 1) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return `${valor.toFixed(casas).replace('.', ',')}%`;
}

type MetricCard = {
  titulo: string;
  descricao?: string;
  destaque?: string;
  metricas: { label: string; valor: string }[];
};

const painelCards = computed<MetricCard[]>(() => {
  const resumo = painelResumo.value;
  if (!resumo) return [];
  const cards: MetricCard[] = [];

  if (resumo.movimentos) {
    cards.push({
      titulo: 'Movimentos',
      descricao: 'Exposição operacional',
      destaque: `${formatNumero(resumo.movimentos.movimentos, 0)} mov`,
      metricas: [
        { label: 'Registros', valor: formatNumero(resumo.movimentos.registros, 0) },
        { label: 'Média/dia', valor: formatNumero(resumo.movimentos.media_diaria, 1) }
      ]
    });
  }

  if (resumo.avistamentos) {
    cards.push({
      titulo: 'Avistamentos',
      descricao: 'Esforço de patrulha',
      destaque: `${formatNumero(resumo.avistamentos.itens, 0)} itens`,
      metricas: [
        { label: 'Registros', valor: formatNumero(resumo.avistamentos.registros, 0) },
        { label: 'Horas', valor: formatNumero(resumo.avistamentos.horas, 1) },
        { label: 'TAH', valor: formatNumero(resumo.avistamentos.tah, 1) }
      ]
    });
  }

  if (resumo.colisoes) {
    cards.push({
      titulo: 'Colisões',
      descricao: 'Eventos e severidade',
      destaque: formatNumero(resumo.colisoes.total, 0),
      metricas: [
        { label: 'SR/10k', valor: formatNumero(resumo.colisoes.sr10k, 2) },
        { label: '% com dano', valor: formatPercent(resumo.colisoes.pct_dano) },
        { label: '% identificadas', valor: formatPercent(resumo.colisoes.pct_identificadas) }
      ]
    });
  }

  if (resumo.acoes) {
    cards.push({
      titulo: 'Ações de controle',
      descricao: 'Resposta no sítio',
      destaque: formatNumero(resumo.acoes.total, 0),
      metricas: [
        { label: 'Letais', valor: formatNumero(resumo.acoes.letais, 0) },
        { label: 'Eficiência média', valor: formatPercent(resumo.acoes.eficacia_media, 1) },
        { label: 'Duração média (min)', valor: formatNumero(resumo.acoes.duracao_media_min, 1) }
      ]
    });
  }

  if (resumo.atrativos) {
    cards.push({
      titulo: 'Atrativos',
      descricao: 'Situação dos focos internos',
      destaque: formatNumero(resumo.atrativos.total, 0),
      metricas: [
        { label: 'Ativos', valor: formatNumero(resumo.atrativos.ativos, 0) },
        { label: 'Mitigando', valor: formatNumero(resumo.atrativos.mitigando, 0) },
        { label: 'Resolvidos', valor: formatNumero(resumo.atrativos.resolvidos, 0) }
      ]
    });
  }

  if (resumo.inspecoes) {
    cards.push({
      titulo: 'Inspeções',
      descricao: 'Site e ASA',
      destaque: formatNumero(resumo.inspecoes.total, 0),
      metricas: [
        { label: 'Site', valor: formatNumero(resumo.inspecoes.site, 0) },
        { label: 'ASA', valor: formatNumero(resumo.inspecoes.asa, 0) }
      ]
    });
  }

  if (resumo.governanca) {
    const gov = resumo.governanca;
    cards.push({
      titulo: 'Governança',
      descricao: 'Programas e requisitos',
      destaque: formatNumero(gov.carcacas, 0),
      metricas: [
        { label: 'Focos ASA', valor: formatNumero(gov.focosAsa?.total, 0) },
        { label: 'Comunicados abertos', valor: formatNumero(gov.comunicados?.em_aberto, 0) },
        { label: 'Treinamentos válidos', valor: formatNumero(gov.treinamentos?.validos, 0) }
      ]
    });
  }

  return cards;
});

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

.metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin: 1rem 0 2rem 0;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.metric-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.metric-card__header h3 {
  margin-bottom: 0.25rem;
}

.metric-card__header p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.metric-card__value {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-primary);
}

dl {
  margin: 0;
}

.metric-line {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
  color: var(--color-text-secondary);
}

.metric-line dt {
  font-weight: 500;
}

.metric-line dd {
  margin: 0;
  font-weight: 600;
  color: var(--color-text-primary);
}

@media (max-width: 768px) {
  .metric-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
