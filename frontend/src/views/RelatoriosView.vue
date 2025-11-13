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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ApiService } from '@/services/api';

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

function formatCurrency(valor?: number | string | null) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(valor?: number | string | null) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toFixed(2);
}

onMounted(async () => {
  await Promise.all([carregarFinanceiro(), carregarIncidentes()]);
});
</script>

<style scoped>
.painel { display: flex; flex-direction: column; gap: 2rem; }
.bloco { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.bloco-topo { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.filtros { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
.filtros label { display: flex; flex-direction: column; gap: .25rem; font-size: .9rem; }
.btn { padding: .55rem 1.2rem; border: none; border-radius: 6px; background: #0f172a; color: #fff; cursor: pointer; }
.tabela table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.tabela th, .tabela td { border-bottom: 1px solid #e5e7eb; padding: .6rem; text-align: left; }
.tabela th { background: #f8fafc; }
.tabela.scroll { overflow-x: auto; }
.grid-analise { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; }
.grid-analise h3 { margin-bottom: .35rem; font-size: 1rem; }
.grid-analise ul { margin: 0; padding-left: 1.1rem; font-size: .9rem; color: #0f172a; }
</style>
