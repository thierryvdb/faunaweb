<template>
  <div class="painel">
    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Indicadores financeiros de colisões</h2>
          <p>Soma e média de custos por ano, categoria taxonômica, tipo de incidente e dano reportado.</p>
        </div>
        <form class="filtros" @submit.prevent="carregarFinanceiro">
          <label>
            Início
            <input type="date" v-model="filtroFinanceiro.inicio" />
          </label>
          <label>
            Fim
            <input type="date" v-model="filtroFinanceiro.fim" />
          </label>
          <button class="btn" type="submit">Recalcular</button>
        </form>
      </header>
      <div class="tabela scroll">
        <table>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Categoria</th>
              <th>Tipo incidente</th>
              <th>Dano</th>
              <th>Eventos</th>
              <th>Custo direto (R$)</th>
              <th>Custo indireto (R$)</th>
              <th>Custo outros (R$)</th>
              <th>Total (R$)</th>
              <th>Severidade média</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="linha in financeiro" :key="`fin-${linha.ano}-${linha.categoria}-${linha.tipo_incidente}-${linha.dano}`">
              <td>{{ linha.ano }}</td>
              <td>{{ linha.categoria }}</td>
              <td>{{ linha.tipo_incidente }}</td>
              <td>{{ linha.dano }}</td>
              <td>{{ linha.eventos }}</td>
              <td>{{ formatCurrency(linha.custo_direto) }}</td>
              <td>{{ formatCurrency(linha.custo_indireto) }}</td>
              <td>{{ formatCurrency(linha.custo_outros) }}</td>
              <td>{{ formatCurrency(linha.custo_total) }}</td>
              <td>{{ formatNumber(linha.severidade_media) }}</td>
            </tr>
            <tr v-if="!financeiro.length">
              <td colspan="10">Sem dados financeiros para o período.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Análises de incidentes</h2>
          <p>Distribuições por ano, categoria, espécie, fase do voo e tipo de incidente.</p>
        </div>
        <form class="filtros" @submit.prevent="carregarIncidentes">
          <label>
            Início
            <input type="date" v-model="filtroIncidentes.inicio" />
          </label>
          <label>
            Fim
            <input type="date" v-model="filtroIncidentes.fim" />
          </label>
          <button class="btn" type="submit">Atualizar</button>
        </form>
      </header>
      <div class="grid-analise">
        <div>
          <h3>Por ano</h3>
          <ul>
            <li v-for="linha in incidentes.porAno" :key="`ano-${linha.ano}`">
              {{ linha.ano }}: {{ linha.eventos }} eventos ({{ linha.com_dano }} com dano)
            </li>
            <li v-if="!incidentes.porAno.length">Sem dados para o período.</li>
          </ul>
        </div>
        <div>
          <h3>Por categoria taxonômica</h3>
          <ul>
            <li v-for="linha in incidentes.porCategoria" :key="`cat-${linha.categoria}`">
              {{ linha.categoria }}: {{ linha.eventos }}
            </li>
            <li v-if="!incidentes.porCategoria.length">Sem dados.</li>
          </ul>
        </div>
        <div>
          <h3>Por tipo de incidente</h3>
          <ul>
            <li v-for="linha in incidentes.porIncidente" :key="`inc-${linha.tipo_incidente}`">
              {{ linha.tipo_incidente }}: {{ linha.eventos }}
            </li>
            <li v-if="!incidentes.porIncidente.length">Sem dados.</li>
          </ul>
        </div>
        <div>
          <h3>Por dano</h3>
          <ul>
            <li v-for="linha in incidentes.porDano" :key="`dano-${linha.dano}`">
              {{ linha.dano }}: {{ linha.eventos }}
            </li>
            <li v-if="!incidentes.porDano.length">Sem dados.</li>
          </ul>
        </div>
        <div>
          <h3>Fase de voo</h3>
          <ul>
            <li v-for="linha in incidentes.porFase" :key="`fase-${linha.fase_voo}`">
              {{ linha.fase_voo }}: {{ linha.eventos }}
            </li>
            <li v-if="!incidentes.porFase.length">Sem dados.</li>
          </ul>
        </div>
        <div>
          <h3>Principais espécies</h3>
          <ul>
            <li v-for="linha in incidentes.principaisEspecies" :key="`esp-${linha.especie}`">
              {{ linha.especie }}: {{ linha.eventos }}
            </li>
            <li v-if="!incidentes.principaisEspecies.length">Sem dados.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Movimentos de aeronaves</h2>
          <p>Comparativo anual e mensal das movimentações registradas.</p>
        </div>
        <form class="filtros" @submit.prevent="carregarMovimentos">
          <label>
            Aeroporto
            <select v-model="filtroMovimentos.airportId">
              <option value="">Todos</option>
              <option v-for="a in aeroportos" :key="a.id ?? a.airport_id" :value="a.id ?? a.airport_id">
                {{ a.name ?? a.nome }}
              </option>
            </select>
          </label>
          <label>
            Ano inicial
            <input type="number" v-model.number="filtroMovimentos.anoInicial" min="2000" max="2100" />
          </label>
          <label>
            Ano final
            <input type="number" v-model.number="filtroMovimentos.anoFinal" min="2000" max="2100" />
        </label>
        <button class="btn" type="submit">Gerar</button>
        <button class="btn btn-secondary" type="button" @click="abrirRelatorioImagens">Relatório com imagens</button>
      </form>
    </header>
      <div v-if="carregandoMovimentos">Carregando movimentos...</div>
      <div v-else-if="erroMovimentos" class="erro">{{ erroMovimentos }}</div>
      <div v-else class="grid-mov">
        <div class="card-mov grafico">
          <h3>Totais por ano</h3>
          <Bar v-if="chartMovimentos" :data="chartMovimentos" :options="chartMovOptions" />
          <p v-else>Sem dados suficientes para montar o gráfico.</p>
        </div>
        <div class="card-mov tabela">
          <h3>Comparativo mensal</h3>
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>
                  {{ relatorioMovimentos?.comparativos?.anoInicial?.ano ?? filtroMovimentos.anoInicial }}
                </th>
                <th>
                  vs {{ relatorioMovimentos?.comparativos?.anoInicial?.ano_referencia ?? filtroMovimentos.anoInicial - 1 }}
                </th>
                <th>
                  {{ relatorioMovimentos?.comparativos?.anoFinal?.ano ?? filtroMovimentos.anoFinal }}
                </th>
                <th>
                  vs {{ relatorioMovimentos?.comparativos?.anoFinal?.ano_referencia ?? filtroMovimentos.anoFinal - 1 }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in comparativoMeses" :key="`mov-${linha.mes}`">
                <td>{{ linha.mesNome }}</td>
                <td>{{ formatInt(linha.anoInicialTotal) }}</td>
                <td>
                  {{ linha.anoInicialVar !== null ? `${formatNumber(linha.anoInicialVar)} %` : '-' }}
                </td>
                <td>{{ formatInt(linha.anoFinalTotal) }}</td>
                <td>
                  {{ linha.anoFinalVar !== null ? `${formatNumber(linha.anoFinalVar)} %` : '-' }}
                </td>
              </tr>
              <tr v-if="!comparativoMeses.length">
                <td colspan="5">Sem dados para o intervalo informado.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Colisões com imagens</h2>
          <p>Consulta e exportação das evidências registradas em um período.</p>
        </div>
        <form class="filtros" @submit.prevent="carregarColisoes">
          <label>
            Aeroporto
            <select v-model="filtroColisoes.airportId">
              <option value="">Todos</option>
              <option v-for="a in aeroportos" :key="a.id ?? a.airport_id" :value="a.id ?? a.airport_id">
                {{ a.name ?? a.nome }}
              </option>
            </select>
          </label>
          <label>
            Início
            <input type="date" v-model="filtroColisoes.inicio" required />
          </label>
          <label>
            Fim
            <input type="date" v-model="filtroColisoes.fim" required />
          </label>
          <button class="btn" type="submit">Carregar</button>
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="!colisoes.dados.length || exportandoColisoes"
            @click="exportarColisoes('pdf')"
          >
            Exportar PDF
          </button>
          <button
            class="btn btn-secondary"
            type="button"
            :disabled="!colisoes.dados.length || exportandoColisoes"
            @click="exportarColisoes('docx')"
          >
            Exportar DOCX
          </button>
        </form>
      </header>
      <LoadingState :carregando="carregandoColisoes" :erro="erroColisoes">
        <p v-if="colisoes.periodo" class="periodo">
          Período: {{ colisoes.periodo.inicio }} a {{ colisoes.periodo.fim }} — {{ colisoes.dados.length }} registros
        </p>
        <div v-if="colisoes.dados.length" class="colisoes-grid">
          <article v-for="item in colisoes.dados" :key="item.id" class="card-mov">
            <header class="colisao-header">
              <strong>#{{ item.id }}</strong>
              <span>{{ item.date_utc }} {{ item.time_local ?? '' }}</span>
            </header>
            <p><strong>Aeroporto:</strong> {{ item.aeroporto ?? item.airport_id }}</p>
            <p><strong>Local:</strong> {{ item.location_nome ?? item.location_id }}</p>
            <p><strong>Evento:</strong> {{ item.event_type ?? 'n/d' }}</p>
            <p><strong>Espécie:</strong> {{ item.especie ?? 'Não informada' }}</p>
            <p><strong>Dano:</strong> {{ item.dano ?? 'Não informado' }}</p>
            <p v-if="item.notes"><strong>Notas:</strong> {{ item.notes }}</p>
            <div class="foto-thumb">
              <img v-if="item.foto_base64" :src="item.foto_base64" alt="Imagem da colisão" />
              <template v-else-if="item.photo_url">
                <span>Foto externa:</span>
                <a :href="item.photo_url" target="_blank" rel="noreferrer">{{ item.photo_url }}</a>
              </template>
              <span v-else>Sem imagem.</span>
            </div>
          </article>
        </div>
        <p v-else class="sem-dados">Nenhuma colisão encontrada para o período informado.</p>
      </LoadingState>
    </section>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '@/services/api';

Chart.register(...registerables);

const hoje = new Date();
const inicioPadrao = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10);
const fimPadrao = new Date().toISOString().slice(0, 10);

const filtroFinanceiro = reactive({
  inicio: inicioPadrao,
  fim: fimPadrao
});
const filtroIncidentes = reactive({
  inicio: inicioPadrao,
  fim: fimPadrao
});

const financeiro = ref<any[]>([]);
const incidentes = reactive({
  porAno: [] as any[],
  porCategoria: [] as any[],
  porIncidente: [] as any[],
  porDano: [] as any[],
  porFase: [] as any[],
  principaisEspecies: [] as any[]
});
const aeroportos = ref<any[]>([]);
const filtroMovimentos = reactive({
  airportId: '' as '' | number,
  anoInicial: hoje.getFullYear() - 1,
  anoFinal: hoje.getFullYear()
});
const relatorioMovimentos = ref<any | null>(null);
const carregandoMovimentos = ref(false);
const erroMovimentos = ref<string | null>(null);
const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const filtroColisoes = reactive({
  airportId: '' as '' | number,
  inicio: inicioPadrao,
  fim: fimPadrao
});
const colisoes = reactive<{ periodo: { inicio: string; fim: string } | null; dados: any[] }>({
  periodo: null,
  dados: []
});
const carregandoColisoes = ref(false);
const erroColisoes = ref<string | null>(null);
const exportandoColisoes = ref(false);

async function carregarFinanceiro() {
  const data = await ApiService.getFinanceiro({
    inicio: filtroFinanceiro.inicio,
    fim: filtroFinanceiro.fim
  });
  financeiro.value = data.dados ?? [];
}

async function carregarIncidentes() {
  const data = await ApiService.getAnaliseIncidentes({
    inicio: filtroIncidentes.inicio,
    fim: filtroIncidentes.fim
  });
  incidentes.porAno = data.porAno ?? [];
  incidentes.porCategoria = data.porCategoria ?? [];
  incidentes.porIncidente = data.porIncidente ?? [];
  incidentes.porDano = data.porDano ?? [];
  incidentes.porFase = data.porFase ?? [];
  incidentes.principaisEspecies = data.principaisEspecies ?? [];
}

async function carregarAeroportos() {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos ?? [];
}

async function carregarMovimentos() {
  if (filtroMovimentos.anoInicial > filtroMovimentos.anoFinal) {
    erroMovimentos.value = 'O ano inicial deve ser menor ou igual ao ano final.';
    return;
  }
  carregandoMovimentos.value = true;
  erroMovimentos.value = null;
  try {
    const params: Record<string, any> = {
      anoInicial: filtroMovimentos.anoInicial,
      anoFinal: filtroMovimentos.anoFinal
    };
    if (filtroMovimentos.airportId) {
      params.airportId = filtroMovimentos.airportId;
    }
    const data = await ApiService.getRelatorioMovimentos(params);
    relatorioMovimentos.value = data;
  } catch (e: any) {
    erroMovimentos.value = e?.message ?? 'Falha ao carregar movimentos';
  } finally {
    carregandoMovimentos.value = false;
  }
}

async function carregarColisoes() {
  carregandoColisoes.value = true;
  erroColisoes.value = null;
  try {
    const params: Record<string, any> = {
      inicio: filtroColisoes.inicio,
      fim: filtroColisoes.fim
    };
    if (filtroColisoes.airportId) {
      params.airportId = filtroColisoes.airportId;
    }
    const data = await ApiService.getRelatorioColisoesImagens(params);
    colisoes.periodo = data.periodo ?? null;
    colisoes.dados = data.dados ?? [];
  } catch (e: any) {
    erroColisoes.value = e?.message ?? 'Falha ao carregar o relatório de colisões';
  } finally {
    carregandoColisoes.value = false;
  }
}

async function exportarColisoes(formato: 'pdf' | 'docx') {
  exportandoColisoes.value = true;
  try {
    const params: Record<string, any> = {
      inicio: filtroColisoes.inicio,
      fim: filtroColisoes.fim,
      formato
    };
    if (filtroColisoes.airportId) {
      params.airportId = filtroColisoes.airportId;
    }
    const resposta = await ApiService.exportarRelatorioColisoesImagens(params);
    const contentType =
      resposta.headers['content-type'] ??
      (formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const blob = new Blob([resposta.data], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nomeArquivo =
      resposta.headers['content-disposition']?.split('filename=').pop()?.replace(/"/g, '') ??
      `relatorio-colisoes.${formato}`;
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    alert(e?.message ?? 'Não foi possível exportar o relatório');
  } finally {
    exportandoColisoes.value = false;
  }
}

function formatCurrency(valor?: number | string | null) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(valor?: number | string | null) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toFixed(2);
}

function formatInt(valor?: number | string | null) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toLocaleString('pt-BR');
}

function abrirRelatorioImagens() {
  window.open('/relatorios/colisoes-imagens', '_blank');
}

const chartMovimentos = computed(() => {
  if (!relatorioMovimentos.value?.meses?.length) return null;
  const totals: Record<string, number> = {};
  for (const mes of relatorioMovimentos.value.meses) {
    const key = String(mes.ano);
    totals[key] = (totals[key] ?? 0) + Number(mes.total ?? 0);
  }
  const labels = Object.keys(totals).sort();
  if (!labels.length) return null;
  return {
    labels,
    datasets: [
      {
        label: 'Movimentos',
        data: labels.map((label) => totals[label]),
        backgroundColor: '#0f172a'
      }
    ]
  };
});

const chartMovOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 }
    }
  }
};

const comparativoMeses = computed(() => {
  if (!relatorioMovimentos.value?.comparativos) return [];
  const comp = relatorioMovimentos.value.comparativos ?? {};
  const inicial = comp.anoInicial?.meses ?? [];
  const final = comp.anoFinal?.meses ?? [];
  const mapIni = new Map(inicial.map((m: any) => [m.mes, m]));
  const mapFim = new Map(final.map((m: any) => [m.mes, m]));
  return NOMES_MESES.map((nome, idx) => {
    const mes = idx + 1;
    const ini = mapIni.get(mes);
    const fim = mapFim.get(mes);
    return {
      mes,
      mesNome: nome,
      anoInicialTotal: ini?.total_atual ?? 0,
      anoInicialVar: ini?.variacao_pct ?? null,
      anoFinalTotal: fim?.total_atual ?? 0,
      anoFinalVar: fim?.variacao_pct ?? null
    };
  });
});

onMounted(async () => {
  await Promise.all([carregarFinanceiro(), carregarIncidentes(), carregarAeroportos()]);
  await Promise.all([carregarMovimentos(), carregarColisoes()]);
});
</script>

<style scoped>
.painel { display: flex; flex-direction: column; gap: 2rem; }
.bloco { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.bloco-topo { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.filtros { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
.filtros label { display: flex; flex-direction: column; gap: .25rem; font-size: .9rem; }
.btn { padding: .55rem 1.2rem; border: none; border-radius: 6px; background: #0f172a; color: #fff; cursor: pointer; }
.btn-secondary { background: #475569; }
.tabela table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.tabela th, .tabela td { border-bottom: 1px solid #e5e7eb; padding: .6rem; text-align: left; }
.tabela th { background: #f8fafc; }
.tabela.scroll { overflow-x: auto; }
.grid-analise { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; }
.grid-analise h3 { margin-bottom: .35rem; font-size: 1rem; }
.grid-analise ul { margin: 0; padding-left: 1.1rem; font-size: .9rem; color: #0f172a; }
.grid-mov { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
.card-mov { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem; }
.card-mov h3 { margin: 0 0 .5rem; }
.card-mov table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.card-mov th, .card-mov td { border-bottom: 1px solid #e2e8f0; padding: .35rem; text-align: left; }
.card-mov th { background: #eef2ff; }
.erro { color: #b91c1c; }
.periodo { font-size: .9rem; color: #475569; }
.colisoes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
.colisao-header { display: flex; justify-content: space-between; font-size: .9rem; }
.foto-thumb { margin-top: .5rem; display: flex; flex-direction: column; gap: .35rem; font-size: .85rem; }
.foto-thumb img { width: 100%; max-height: 180px; object-fit: cover; border-radius: 10px; border: 1px solid #dbeafe; }
</style>
