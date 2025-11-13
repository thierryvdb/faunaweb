<template>
  <div class="painel">
    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Inspeções no sítio e ASA</h2>
          <p>Registro diário das inspeções exigidas pelo manual (mapa de grade, clima e achados).</p>
        </div>
        <form class="filtros" @submit.prevent="carregarInspecoes">
          <label>
            Tipo
            <select v-model="filtros.tipo">
              <option value="">Todos</option>
              <option value="site">Sítio aeroportuário</option>
              <option value="asa">ASA</option>
            </select>
          </label>
          <label>
            Início
            <input type="date" v-model="filtros.inicio" />
          </label>
          <label>
            Fim
            <input type="date" v-model="filtros.fim" />
          </label>
          <button class="btn" type="submit">Atualizar</button>
        </form>
      </header>
      <form class="grid" @submit.prevent="salvarInspecao">
        <label>
          Tipo*
          <select v-model="formInspecao.inspection_type" required>
            <option value="site">Sítio</option>
            <option value="asa">ASA</option>
          </select>
        </label>
        <label>
          Data*
          <input type="date" v-model="formInspecao.date_utc" required />
        </label>
        <label>
          Horário inicial
          <input type="time" v-model="formInspecao.start_time" />
        </label>
        <label>
          Horário final
          <input type="time" v-model="formInspecao.end_time" />
        </label>
        <label>
          Equipe
          <input type="text" v-model="formInspecao.team_name" placeholder="Equipe/turno" />
        </label>
        <label>
          Condições climáticas
          <input type="text" v-model="formInspecao.weather_summary" placeholder="Nublado, chuva leve..." />
        </label>
        <label class="wide">
          Percurso / locais
          <input type="text" v-model="formInspecao.route_summary" placeholder="Ex.: pista 15/33, pátio norte..." />
        </label>
        <label>
          Quadrantes (separar por vírgula)
          <input type="text" v-model="gridRefsText" placeholder="A1,B3,C2" />
        </label>
        <label class="wide">
          Observações estruturadas (cada linha: tipo | descrição | severidade)
          <textarea v-model="observacoesTexto" rows="3" placeholder="foco atrativo | lago próximo TWY B | alta"></textarea>
        </label>
        <label class="wide">
          Notas gerais
          <textarea v-model="formInspecao.notes" rows="2"></textarea>
        </label>
        <button class="btn principal" :disabled="salvandoInspecao">
          {{ salvandoInspecao ? 'Salvando...' : 'Registrar inspeção' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Equipe</th>
              <th>Resumo</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in inspecoes" :key="item.inspection_id">
              <td>{{ item.date_utc }} {{ item.start_time || '' }}</td>
              <td>{{ item.inspection_type === 'site' ? 'Sítio' : 'ASA' }}</td>
              <td>{{ item.team_name }}</td>
              <td>
                <strong>Clima:</strong> {{ item.weather_summary || '-' }}<br>
                <strong>Rota:</strong> {{ item.route_summary || '-' }}<br>
                <strong>Quadrantes:</strong> {{ (item.grid_refs || []).join(', ') || '-' }}
              </td>
              <td>
                <ul>
                  <li v-for="(obs, idx) in item.observations || []" :key="idx">
                    <strong>{{ obs.tipo }}</strong> - {{ obs.descricao }} <em>({{ obs.severidade || 's/ classificação' }})</em>
                  </li>
                </ul>
              </td>
            </tr>
            <tr v-if="!inspecoes.length">
              <td colspan="5">Nenhum registro encontrado no período selecionado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Carcaças recolhidas</h2>
          <p>Controle sanitário com destino (aterro/autoclave/incineração) conforme manual.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarCarcaca">
        <label>
          Data*
          <input type="date" v-model="formCarcaca.date_utc" required />
        </label>
        <label>
          Horário
          <input type="time" v-model="formCarcaca.time_local" />
        </label>
        <label>
          Local
          <input type="text" v-model="formCarcaca.location_id" placeholder="ID do local" />
        </label>
        <label>
          Quadrante
          <input type="text" v-model="formCarcaca.quadrant" />
        </label>
        <label>
          Espécie
          <input type="text" v-model="formCarcaca.species_guess" placeholder="Caso não identificada no banco" />
        </label>
        <label>
          Quantidade
          <input type="number" min="1" v-model.number="formCarcaca.quantity" />
        </label>
        <label>
          Peso estimado (g)
          <input type="number" min="0" step="1" v-model.number="formCarcaca.mass_grams" />
        </label>
        <label>
          Destino
          <select v-model="formCarcaca.destination">
            <option value="">Selecione</option>
            <option value="aterro">Aterro</option>
            <option value="autoclave">Autoclave</option>
            <option value="incineracao">Incinerado</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label class="wide">
          Notas
          <textarea rows="2" v-model="formCarcaca.notes"></textarea>
        </label>
        <button class="btn principal" :disabled="salvandoCarcaca">
          {{ salvandoCarcaca ? 'Salvando...' : 'Registrar carcaça' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Local/quadrante</th>
              <th>Espécie</th>
              <th>Qtd</th>
              <th>Destino</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in carcacas" :key="item.carcass_id">
              <td>{{ item.date_utc }} {{ item.time_local || '' }}</td>
              <td>#{{ item.location_id || '-' }} / {{ item.quadrant || '-' }}</td>
              <td>{{ item.species_name || item.species_guess || '-' }}</td>
              <td>{{ item.quantity || 1 }}</td>
              <td>{{ destinoLabel(item.destination) }}</td>
              <td>{{ item.notes || '-' }}</td>
            </tr>
            <tr v-if="!carcacas.length">
              <td colspan="6">Nenhum registro ainda.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Auditorias ambientais</h2>
          <p>Resíduos, esgotamento, focos secundários e sistemas de proteção monitorados.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarAuditoria">
        <label>
          Data*
          <input type="date" v-model="formAuditoria.date_utc" required />
        </label>
        <label>
          Categoria*
          <select v-model="formAuditoria.category" required>
            <option value="residuos">Resíduos sólidos</option>
            <option value="esgoto">Esgotamento sanitário</option>
            <option value="sistema_protecao">Sistema de proteção</option>
            <option value="foco_secundario">Foco secundário</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label>
          Área/Referência
          <input type="text" v-model="formAuditoria.area_reference" />
        </label>
        <label>
          Status
          <select v-model="formAuditoria.status">
            <option value="">-</option>
            <option value="pendente">Pendente</option>
            <option value="em_execucao">Em execução</option>
            <option value="resolvido">Resolvido</option>
          </select>
        </label>
        <label class="wide">
          Achados
          <textarea rows="2" v-model="formAuditoria.findings"></textarea>
        </label>
        <label class="wide">
          Ações planejadas
          <textarea rows="2" v-model="formAuditoria.actions_planned"></textarea>
        </label>
        <label>
          Responsável
          <input type="text" v-model="formAuditoria.responsible_party" />
        </label>
        <label>
          Follow-up
          <input type="date" v-model="formAuditoria.follow_up_date" />
        </label>
        <button class="btn principal" :disabled="salvandoAuditoria">
          {{ salvandoAuditoria ? 'Salvando...' : 'Registrar auditoria' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Área</th>
              <th>Achados</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in auditorias" :key="item.audit_id">
              <td>{{ item.date_utc }}</td>
              <td>{{ categoriaLabel(item.category) }}</td>
              <td>{{ item.area_reference || '-' }}</td>
              <td>
                <strong>Achado:</strong> {{ item.findings || '-' }}<br>
                <strong>Ação:</strong> {{ item.actions_planned || '-' }}<br>
                <strong>Follow-up:</strong> {{ item.follow_up_date || '-' }}
              </td>
              <td>{{ statusLabel(item.status) }}</td>
            </tr>
            <tr v-if="!auditorias.length">
              <td colspan="5">Ainda sem auditorias registradas.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ApiService } from '@/services/api';

const filtros = reactive({
  tipo: '',
  inicio: '',
  fim: ''
});

const inspecoes = ref<any[]>([]);
const carcacas = ref<any[]>([]);
const auditorias = ref<any[]>([]);

const formInspecao = reactive({
  airport_id: 1,
  inspection_type: 'site',
  date_utc: new Date().toISOString().slice(0, 10),
  start_time: '',
  end_time: '',
  team_name: '',
  weather_summary: '',
  route_summary: '',
  notes: ''
});
const gridRefsText = ref('');
const observacoesTexto = ref('');
const salvandoInspecao = ref(false);

const formCarcaca = reactive({
  airport_id: 1,
  date_utc: new Date().toISOString().slice(0, 10),
  time_local: '',
  location_id: '',
  quadrant: '',
  species_guess: '',
  quantity: 1,
  mass_grams: undefined as number | undefined,
  destination: '',
  notes: ''
});
const salvandoCarcaca = ref(false);

const formAuditoria = reactive({
  airport_id: 1,
  date_utc: new Date().toISOString().slice(0, 10),
  category: 'residuos',
  area_reference: '',
  status: '',
  findings: '',
  actions_planned: '',
  responsible_party: '',
  follow_up_date: ''
});
const salvandoAuditoria = ref(false);

function airportIdAtual() {
  return ApiService.getUser<any>()?.aeroporto_id ?? formInspecao.airport_id;
}

async function carregarInspecoes() {
  const params: Record<string, any> = {};
  if (filtros.tipo) params.tipo = filtros.tipo;
  if (filtros.inicio) params.inicio = filtros.inicio;
  if (filtros.fim) params.fim = filtros.fim;
  params.airportId = airportIdAtual();
  const data = await ApiService.getInspecoes(params);
  inspecoes.value = data;
}

async function salvarInspecao() {
  salvandoInspecao.value = true;
  try {
    const payload = {
      ...formInspecao,
      airport_id: airportIdAtual(),
      grid_refs: gridRefsText.value
        ? gridRefsText.value.split(',').map((g) => g.trim()).filter(Boolean)
        : [],
      observations: parseObservacoes(observacoesTexto.value)
    };
    await ApiService.criarInspecao(payload);
    observacoesTexto.value = '';
    gridRefsText.value = '';
    formInspecao.route_summary = '';
    formInspecao.weather_summary = '';
    formInspecao.team_name = '';
    formInspecao.notes = '';
    await carregarInspecoes();
  } finally {
    salvandoInspecao.value = false;
  }
}

function parseObservacoes(texto: string) {
  if (!texto.trim()) return [];
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [tipo = 'achado', descricao = '', severidade = ''] = linha.split('|').map((p) => p.trim());
      return { tipo, descricao, severidade };
    });
}

async function carregarCarcacas() {
  const params = { airportId: airportIdAtual() };
  const data = await ApiService.getCarcacas(params);
  carcacas.value = data;
}

async function salvarCarcaca() {
  salvandoCarcaca.value = true;
  try {
    const payload = {
      ...formCarcaca,
      airport_id: airportIdAtual(),
      location_id: formCarcaca.location_id ? Number(formCarcaca.location_id) : undefined,
      mass_grams: formCarcaca.mass_grams || undefined,
      destination: formCarcaca.destination || undefined
    };
    await ApiService.criarCarcaca(payload);
    formCarcaca.location_id = '';
    formCarcaca.quadrant = '';
    formCarcaca.species_guess = '';
    formCarcaca.notes = '';
    await carregarCarcacas();
  } finally {
    salvandoCarcaca.value = false;
  }
}

async function carregarAuditorias() {
  const params = { airportId: airportIdAtual() };
  const data = await ApiService.getAuditoriasAmbientais(params);
  auditorias.value = data;
}

async function salvarAuditoria() {
  salvandoAuditoria.value = true;
  try {
    const payload = {
      ...formAuditoria,
      airport_id: airportIdAtual(),
      status: formAuditoria.status || undefined
    };
    await ApiService.criarAuditoriaAmbiental(payload);
    formAuditoria.area_reference = '';
    formAuditoria.findings = '';
    formAuditoria.actions_planned = '';
    formAuditoria.responsible_party = '';
    await carregarAuditorias();
  } finally {
    salvandoAuditoria.value = false;
  }
}

function destinoLabel(value?: string) {
  switch (value) {
    case 'aterro':
      return 'Aterro';
    case 'autoclave':
      return 'Autoclave';
    case 'incineracao':
      return 'Incineração';
    case 'outro':
      return 'Outro';
    default:
      return '-';
  }
}

function categoriaLabel(value?: string) {
  const map: Record<string, string> = {
    residuos: 'Resíduos',
    esgoto: 'Esgotamento',
    sistema_protecao: 'Sistema de proteção',
    foco_secundario: 'Focos secundários',
    outro: 'Outro'
  };
  return map[value || ''] || '-';
}

function statusLabel(value?: string) {
  const map: Record<string, string> = {
    pendente: 'Pendente',
    em_execucao: 'Em execução',
    resolvido: 'Resolvido'
  };
  return map[value || ''] || '-';
}

onMounted(async () => {
  await Promise.all([carregarInspecoes(), carregarCarcacas(), carregarAuditorias()]);
});
</script>

<style scoped>
.painel { display: flex; flex-direction: column; gap: 2rem; }
.bloco { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.bloco-topo { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.filtros { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
.grid label { display: flex; flex-direction: column; gap: .35rem; font-size: .9rem; }
.grid textarea, .grid input, .grid select { padding: .45rem .6rem; border: 1px solid #cbd5f5; border-radius: 6px; }
.grid .wide { grid-column: span 2; }
.btn { padding: .55rem 1.2rem; border: none; border-radius: 6px; background: #0f172a; color: #fff; cursor: pointer; }
.btn.principal { background: #0ea5e9; }
.tabela table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.tabela th, .tabela td { border-bottom: 1px solid #e5e7eb; padding: .6rem; vertical-align: top; }
.tabela th { text-align: left; background: #f8fafc; }
@media (max-width: 768px) {
  .grid .wide { grid-column: span 1; }
}
</style>
