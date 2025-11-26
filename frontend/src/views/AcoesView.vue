<template>
  <div class="layout">
    <section class="card">
      <header class="cabecalho">
        <div>
          <h3>Ações de controle</h3>
          <p class="subtitulo">Visualize e edite o histórico de intervenções em pista/infraestrutura.</p>
        </div>
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
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem ações registradas">
          <template #date_br="{ valor }">{{ valor ?? '-' }}</template>
          <template #tipo_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #local_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>
        </DataTable>
      </LoadingState>
    </section>

    <section class="painel-form">
      <div class="card formulario">
        <header class="cabecalho">
          <div>
            <h3>{{ editandoId ? 'Editar ação' : 'Registrar ação' }}</h3>
            <p class="subtitulo">Estruture o registro por categoria para acelerar análises e follow-ups.</p>
          </div>
          <button v-if="editandoId" class="btn btn-secondary" type="button" @click="cancelarEdicao">Cancelar</button>
        </header>

        <form class="form" @submit.prevent="salvar">
          <div class="secao">
            <h4>Identificação</h4>
            <div class="grid-2">
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
                Hora local
                <input type="time" v-model="nova.time_local" />
              </label>
              <label>
                Local
                <select v-model.number="nova.location_id">
                  <option :value="undefined">Selecione</option>
                  <option v-for="loc in locaisAtivos" :key="loc.id" :value="loc.id">{{ loc.code }}</option>
                </select>
              </label>
              <label>
                Tipo de ação
                <select v-model.number="nova.action_type_id">
                  <option :value="undefined">Selecione</option>
                  <option v-for="t in lookups.tipos_acao" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </label>
              <label>
                Duração (min)
                <input type="number" v-model.number="nova.duration_min" min="0" placeholder="0" />
              </label>
            </div>
            <label>
              Descrição breve
              <input type="text" v-model="nova.description" placeholder="Ex.: Inspeção visual e contenção provisória" />
            </label>
          </div>

          <div class="secao categorias">
            <header>
              <h4>Checklists por categoria</h4>
              <p>Marque os itens relevantes; o resumo é montado automaticamente.</p>
            </header>
            <div class="grid-categorias">
              <div class="categoria-card" v-for="config in categoriaConfiguracoes" :key="config.key">
                <div class="categoria-cabecalho">
                  <h5>{{ config.label }}</h5>
                  <p>{{ config.descricao }}</p>
                </div>
                <div v-if="config.key === 'infra'" class="categoria-conteudo">
                  <label class="checkbox" v-for="opcao in config.opcoes" :key="opcao.campo">
                    <input type="checkbox" v-model="categorias.infra[opcao.campo]" />
                    {{ opcao.rotulo }}
                  </label>
                  <label>
                    Observações
                    <textarea rows="2" v-model="categorias.infra.observacao" placeholder="Detalhes do reparo ou risco"></textarea>
                  </label>
                </div>
                <div v-else-if="config.key === 'fauna'" class="categoria-conteudo">
                  <label>
                    Método empregado
                    <input type="text" v-model="categorias.fauna.metodo" placeholder="Pirotecnia, veículo, falcoaria..." />
                  </label>
                  <div class="grid-2">
                    <label>
                      Intensidade
                      <select v-model="categorias.fauna.intensidade">
                        <option value="baixa">Baixa</option>
                        <option value="moderada">Moderada</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>
                    <label>
                      Duração (min)
                      <input type="number" min="0" v-model.number="categorias.fauna.duracao_min" />
                    </label>
                  </div>
                  <label>
                    Efetividade estimada (%)
                    <input type="number" min="0" max="100" v-model.number="categorias.fauna.eficacia" />
                  </label>
                  <label>
                    Observações
                    <textarea rows="2" v-model="categorias.fauna.observacao"></textarea>
                  </label>
                </div>
                <div v-else-if="config.key === 'saneamento'" class="categoria-conteudo">
                  <label class="checkbox" v-for="opcao in config.opcoes" :key="opcao.campo">
                    <input type="checkbox" v-model="categorias.saneamento[opcao.campo]" />
                    {{ opcao.rotulo }}
                  </label>
                  <label>
                    Severidade
                    <select v-model="categorias.saneamento.severidade">
                      <option value="baixa">Baixa</option>
                      <option value="moderada">Moderada</option>
                      <option value="alta">Alta</option>
                    </select>
                  </label>
                  <label>
                    Observações
                    <textarea rows="2" v-model="categorias.saneamento.observacao" placeholder="Ações corretivas sugeridas"></textarea>
                  </label>
                </div>
              </div>
            </div>
            <div class="acoes-rapidas">
              <span>Modelos rápidos:</span>
              <button type="button" class="btn btn-chip" @click="aplicarTemplate('infra')">Reparo de cerca</button>
              <button type="button" class="btn btn-chip" @click="aplicarTemplate('fauna')">Afugentamento padrão</button>
              <button type="button" class="btn btn-chip" @click="aplicarTemplate('saneamento')">Limpeza de drenagem</button>
            </div>
          </div>

          <div class="secao">
            <h4>Observações gerais</h4>
            <textarea rows="3" v-model="observacoesExtras" placeholder="Informações adicionais, contato, protocolo etc."></textarea>
          </div>

          <div class="secao resumo">
            <h4>Resumo estruturado</h4>
            <p v-if="!resumoCategorias">Marque alguma categoria para gerar o resumo automaticamente.</p>
            <ul v-else>
              <li v-for="linha in resumoCategorias.split('\n')" :key="linha">{{ linha }}</li>
            </ul>
          </div>

          <button class="btn btn-primary" type="submit">{{ editandoId ? 'Atualizar' : 'Salvar' }}</button>
        </form>
      </div>

      <div class="card resumo-rapido">
        <h4>Últimas ações</h4>
        <ul>
          <li v-for="acao in ultimasAcoes" :key="acao.id">
            <strong>{{ acao.date_br ?? '-' }}</strong> — {{ acao.tipo_nome }}<br />
            <small>{{ acao.result_notes || 'Sem observações' }}</small>
          </li>
        </ul>
      </div>

      <div class="card">
        <h3>Avaliação rápida (BA espacial)</h3>
        <form class="form" @submit.prevent="rodarBa">
          <label>
            ID da ação
            <input type="number" v-model.number="metrica.action_id" required />
          </label>
          <div class="grid-2">
            <label>
              Raio (m)
              <input type="number" v-model.number="metrica.raio_m" min="50" />
            </label>
            <label>
              Janela (dias)
              <input type="number" v-model.number="metrica.janela_dias" min="7" />
            </label>
          </div>
          <button class="btn btn-secondary" type="submit">Calcular</button>
        </form>
        <div v-if="resultadoBa" class="resultado">
          <p><strong>SR pré:</strong> {{ resultadoBa.sr10k_pre ?? '-' }}</p>
          <p><strong>SR pós:</strong> {{ resultadoBa.sr10k_pos ?? '-' }}</p>
          <p><strong>RR:</strong> {{ resultadoBa.rr ?? '-' }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import DataTable from '@/components/DataTable.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService, api } from '@/services/api';

const colunas = [
  { titulo: 'Data', campo: 'date_br' },
  { titulo: 'Tipo', campo: 'tipo_nome' },
  { titulo: 'Local', campo: 'local_nome' },
  { titulo: 'Duração (min)', campo: 'duration_min' },
  { titulo: 'Observações', campo: 'result_notes' },
  { titulo: 'Ações', campo: 'acoes' }
];

const categoriaConfiguracoes = [
  {
    key: 'infra',
    label: 'Infraestrutura',
    descricao: 'Registre danos em cercas, mourões, portões e estruturas.',
    opcoes: [
      { campo: 'cerca_danificada', rotulo: 'Cerca danificada' },
      { campo: 'mourao_caido', rotulo: 'Mourão caído' },
      { campo: 'portao_avariado', rotulo: 'Portão avariado' }
    ]
  },
  {
    key: 'fauna',
    label: 'Afugentamento de fauna',
    descricao: 'Detalhe o método, intensidade e duração do afugentamento.'
  },
  {
    key: 'saneamento',
    label: 'Drenagem / ETE',
    descricao: 'Obstruções de valas, falhas na ETE e outras intercorrências.',
    opcoes: [
      { campo: 'vala_obstruida', rotulo: 'Vala de drenagem obstruída' },
      { campo: 'falha_ete', rotulo: 'Falha na ETE' },
      { campo: 'outra_intercorrencia', rotulo: 'Outra intercorrência' }
    ]
  }
] as const;

const filtros = ref<{ airportId?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ tipos_acao: [] });
const locaisPorAeroporto = ref<Record<number, any[]>>({});
const carregando = ref(false);
const erro = ref<string | null>(null);
const nova = ref({
  airport_id: '' as any,
  date_utc: '',
  time_local: '',
  location_id: undefined as any,
  action_type_id: undefined as any,
  duration_min: 0,
  description: '',
  result_notes: ''
});
const observacoesExtras = ref('');
const categorias = ref({
  infra: { cerca_danificada: false, mourao_caido: false, portao_avariado: false, observacao: '' },
  fauna: { metodo: '', intensidade: 'moderada', duracao_min: 0, eficacia: 70, observacao: '' },
  saneamento: {
    vala_obstruida: false,
    falha_ete: false,
    outra_intercorrencia: false,
    severidade: 'baixa',
    observacao: ''
  }
});
const metrica = ref({ action_id: undefined as any, raio_m: 500, janela_dias: 30 });
const resultadoBa = ref<any | null>(null);
const editandoId = ref<number | null>(null);

const locaisAtivos = computed(() => {
  const id = Number(nova.value.airport_id);
  if (!id || !locaisPorAeroporto.value[id]) return [];
  return locaisPorAeroporto.value[id];
});

const resumoCategorias = computed(() => {
  const linhas: string[] = [];
  const infra = categorias.value.infra;
  const marcadosInfra = [
    infra.cerca_danificada ? 'cerca danificada' : null,
    infra.mourao_caido ? 'mourão caído' : null,
    infra.portao_avariado ? 'portão avariado' : null
  ].filter(Boolean);
  if (marcadosInfra.length || infra.observacao) {
    linhas.push(`Infraestrutura: ${[...marcadosInfra, infra.observacao].filter(Boolean).join('; ')}`);
  }
  const fauna = categorias.value.fauna;
  if (fauna.metodo || fauna.observacao) {
    linhas.push(
      `Afugentamento: método ${fauna.metodo || 'não informado'}, intensidade ${fauna.intensidade}, duração ${
        fauna.duracao_min || 0
      } min, eficácia estimada ${fauna.eficacia}%${fauna.observacao ? ` (${fauna.observacao})` : ''}`
    );
  }
  const saneamento = categorias.value.saneamento;
  const marcadosSanea = [
    saneamento.vala_obstruida ? 'vala obstruída' : null,
    saneamento.falha_ete ? 'falha na ETE' : null,
    saneamento.outra_intercorrencia ? 'outra intercorrência' : null
  ].filter(Boolean);
  if (marcadosSanea.length || saneamento.observacao) {
    linhas.push(
      `Drenagem/ETE: ${[...marcadosSanea, `severidade ${saneamento.severidade}`, saneamento.observacao]
        .filter(Boolean)
        .join('; ')}`
    );
  }
  return linhas.join('\n');
});

const ultimasAcoes = computed(() => lista.value.slice(0, 4));

async function garantirLocais(airportId?: number) {
  if (!airportId) return;
  const idNum = Number(airportId);
  if (!idNum || locaisPorAeroporto.value[idNum]) return;
  const dados = await ApiService.getLocaisPorAeroporto(idNum);
  locaisPorAeroporto.value = {
    ...locaisPorAeroporto.value,
    [idNum]: dados.map((item: any) => ({
      id: item.location_id ?? item.id ?? item.locationId,
      code: item.code ?? item.description ?? `Local #${item.location_id}`
    }))
  };
}

function resetarCategorias() {
  categorias.value = {
    infra: { cerca_danificada: false, mourao_caido: false, portao_avariado: false, observacao: '' },
    fauna: { metodo: '', intensidade: 'moderada', duracao_min: 0, eficacia: 70, observacao: '' },
    saneamento: {
      vala_obstruida: false,
      falha_ete: false,
      outra_intercorrencia: false,
      severidade: 'baixa',
      observacao: ''
    }
  };
  observacoesExtras.value = '';
}

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getAcoes(filtros.value);
    const aeroportosUnicos = Array.from(new Set(dados.map((acao: any) => acao.airport_id).filter(Boolean))) as number[];
    for (const airportId of aeroportosUnicos) {
      await garantirLocais(airportId);
    }
    lista.value = dados.map((acao: any) => {
      const locs = locaisPorAeroporto.value[acao.airport_id] ?? [];
      return {
        ...acao,
        date_br: acao.date_utc ? new Date(acao.date_utc).toLocaleDateString('pt-BR') : null,
        tipo_nome: lookups.value.tipos_acao.find((t: any) => t.id === acao.action_type_id)?.name ?? '-',
        local_nome: locs.find((loc: any) => loc.id === acao.location_id)?.code ?? '-'
      };
    });
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar ações';
  } finally {
    carregando.value = false;
  }
}

function montarPayload() {
  const resumo = resumoCategorias.value;
  const notas = [resumo, observacoesExtras.value].filter((parte) => parte && parte.trim().length).join('\n\n');
  return {
    ...nova.value,
    result_notes: notas || nova.value.result_notes || ''
  };
}

async function salvar() {
  try {
    const payload = montarPayload();
    if (editandoId.value) {
      await api.put(`/acoes-controle/${editandoId.value}`, payload);
    } else {
      await api.post('/acoes-controle', payload);
    }
    await carregar();
    cancelarEdicao();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function cancelarEdicao() {
  editandoId.value = null;
  nova.value = {
    airport_id: nova.value.airport_id ?? ('' as any),
    date_utc: '',
    time_local: '',
    location_id: undefined as any,
    action_type_id: undefined as any,
    duration_min: 0,
    description: '',
    result_notes: ''
  };
  resetarCategorias();
}

function editar(acao: any) {
  editandoId.value = acao.id;
  nova.value = {
    airport_id: acao.airport_id,
    date_utc: acao.date_utc ? acao.date_utc.slice(0, 10) : '',
    time_local: acao.time_local ?? '',
    location_id: acao.location_id ?? undefined,
    action_type_id: acao.action_type_id,
    duration_min: acao.duration_min ?? 0,
    description: acao.description ?? '',
    result_notes: acao.result_notes ?? ''
  } as any;
  observacoesExtras.value = acao.result_notes ?? '';
  resetarCategorias();
  garantirLocais(acao.airport_id);
}

function aplicarTemplate(tipo: 'infra' | 'fauna' | 'saneamento') {
  if (tipo === 'infra') {
    categorias.value.infra.cerca_danificada = true;
    categorias.value.infra.mourao_caido = false;
    categorias.value.infra.portao_avariado = false;
    categorias.value.infra.observacao = 'Sinalização provisória instalada aguardando manutenção';
  } else if (tipo === 'fauna') {
    categorias.value.fauna.metodo = 'Pirotecnia + veículo';
    categorias.value.fauna.intensidade = 'alta';
    categorias.value.fauna.duracao_min = 20;
    categorias.value.fauna.eficacia = 85;
    categorias.value.fauna.observacao = 'Dispersão efetiva em 2 ciclos';
  } else {
    categorias.value.saneamento.vala_obstruida = true;
    categorias.value.saneamento.falha_ete = false;
    categorias.value.saneamento.outra_intercorrencia = false;
    categorias.value.saneamento.severidade = 'moderada';
    categorias.value.saneamento.observacao = 'Solicitada equipe de limpeza em até 4h';
  }
}

async function rodarBa() {
  try {
    const { data } = await api.post('/kpis/ba-espacial', metrica.value);
    resultadoBa.value = data;
  } catch (e: any) {
    alert(e?.message ?? 'Falha ao calcular');
  }
}

watch(
  () => nova.value.airport_id,
  async () => {
    if (nova.value.airport_id) {
      await garantirLocais(nova.value.airport_id);
      try {
        const user = ApiService.getUser<any>();
        if (user?.aeroporto_id && user.aeroporto_id !== nova.value.airport_id) {
          await ApiService.switchAirport(Number(nova.value.airport_id));
        }
      } catch {}
    } else {
      nova.value.location_id = undefined as any;
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
      await garantirLocais(user.aeroporto_id);
    }
    await carregar();
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao carregar dados';
  }
});
</script>

<style scoped>
.layout {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.subtitulo {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.filtros select {
  min-width: 220px;
}

.painel-form {
  flex: 1 1 480px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.formulario {
  padding-bottom: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.secao {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem;
  background: var(--color-bg-secondary);
}

.secao header {
  margin-bottom: 0.75rem;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.grid-2 label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.secao label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 0.35rem;
}

select,
input,
textarea {
  padding: 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}

.categorias header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.grid-categorias {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.categoria-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.categoria-cabecalho h5 {
  margin: 0;
  font-size: 1rem;
}

.categoria-cabecalho p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.categoria-conteudo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.acoes-rapidas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.btn-chip {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.8rem;
}

.resumo ul {
  margin: 0;
  padding-left: 1.25rem;
}

.resumo-rapido ul {
  list-style: none;
  padding-left: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.resumo-rapido li {
  border-left: 3px solid var(--color-primary);
  padding-left: 0.75rem;
}

.resultado {
  margin-top: 1rem;
  background: #f1f5f9;
  padding: 1rem;
  border-radius: 8px;
}

@media (max-width: 960px) {
  .layout {
    flex-direction: column;
  }
}
</style>
