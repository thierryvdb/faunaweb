<template>
  <div class="painel">
    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Focos atrativos na ASA</h2>
          <p>Registro atualizado por município, protocolo e status de mitigação.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarFoco">
        <label>
          Município
          <input type="text" v-model="formFoco.municipality" required />
        </label>
        <label>
          Tipo de foco
          <input type="text" v-model="formFoco.focus_type" placeholder="Aterro, lagoa, cultivo..." />
        </label>
        <label class="wide">
          Descrição
          <textarea rows="2" v-model="formFoco.description"></textarea>
        </label>
        <label>
          Distância (km)
          <input type="number" min="0" step="0.1" v-model.number="formFoco.distance_km" />
        </label>
        <label>
          Status
          <select v-model="formFoco.status">
            <option value="monitorado">Monitorado</option>
            <option value="em_gestao">Em gestão</option>
            <option value="mitigado">Mitigado</option>
          </select>
        </label>
        <label>
          Responsável
          <input type="text" v-model="formFoco.responsible_org" />
        </label>
        <label>
          Protocolo
          <input type="text" v-model="formFoco.protocol_ref" />
        </label>
        <label>
          Próximo follow-up
          <input type="date" v-model="formFoco.next_follow_up" />
        </label>
        <button class="btn principal" :disabled="salvandoFoco">
          {{ salvandoFoco ? 'Salvando...' : 'Registrar foco ASA' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Município</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Distância</th>
              <th>Protocolo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in focos" :key="item.asa_focus_id">
              <td>{{ item.municipality || '-' }}</td>
              <td>{{ item.focus_type || '-' }}</td>
              <td>{{ focoStatus(item.status) }}</td>
              <td>{{ item.distance_km ? item.distance_km + ' km' : '-' }}</td>
              <td>
                {{ item.protocol_ref || '-' }}<br>
                <small>Follow-up: {{ item.next_follow_up || '-' }}</small>
              </td>
            </tr>
            <tr v-if="!focos.length">
              <td colspan="5">Nenhum foco cadastrado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Comunicações externas</h2>
          <p>Rastreia ofícios enviados a órgãos municipais, ambientais e operadores vizinhos.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarComunicado">
        <label>
          Entidade*
          <input type="text" v-model="formComunicado.target_entity" required />
        </label>
        <label>
          Assunto
          <input type="text" v-model="formComunicado.subject" />
        </label>
        <label>
          Protocolo
          <input type="text" v-model="formComunicado.protocol_code" />
        </label>
        <label>
          Status
          <select v-model="formComunicado.status">
            <option value="enviado">Enviado</option>
            <option value="em_andamento">Em andamento</option>
            <option value="respondido">Respondido</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </label>
        <label>
          Data envio
          <input type="date" v-model="formComunicado.sent_at" />
        </label>
        <label>
          Prazo resposta
          <input type="date" v-model="formComunicado.response_due_at" />
        </label>
        <label class="wide">
          Observações
          <textarea rows="2" v-model="formComunicado.notes"></textarea>
        </label>
        <button class="btn principal" :disabled="salvandoComunicado">
          {{ salvandoComunicado ? 'Salvando...' : 'Registrar comunicação' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Entidade</th>
              <th>Assunto</th>
              <th>Status</th>
              <th>Protocolo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in comunicados" :key="item.notice_id">
              <td>{{ item.target_entity }}</td>
              <td>{{ item.subject || '-' }}</td>
              <td>{{ comunicadoStatus(item.status) }}</td>
              <td>
                {{ item.protocol_code || '-' }}<br>
                <small>Enviado: {{ item.sent_at || '-' }}</small>
              </td>
            </tr>
            <tr v-if="!comunicados.length">
              <td colspan="4">Nenhuma comunicação lançada.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Treinamentos e educação</h2>
          <p>Programa contínuo de capacitação exigido pelo capítulo 8 do manual.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarTreinamento">
        <label>
          Título*
          <input type="text" v-model="formTreinamento.title" required />
        </label>
        <label>
          Público-alvo
          <input type="text" v-model="formTreinamento.audience" />
        </label>
        <label>
          Início*
          <input type="date" v-model="formTreinamento.start_date" required />
        </label>
        <label>
          Fim
          <input type="date" v-model="formTreinamento.end_date" />
        </label>
        <label>
          Carga horária
          <input type="number" min="0" step="0.5" v-model.number="formTreinamento.hours_total" />
        </label>
        <label>
          Instrutor
          <input type="text" v-model="formTreinamento.instructor" />
        </label>
        <label class="wide">
          Tópicos (separe por vírgula)
          <input type="text" v-model="topicosTexto" />
        </label>
        <label class="wide">
          Participantes (cada linha: nome | função | organização)
          <textarea rows="2" v-model="participantesTexto"></textarea>
        </label>
        <button class="btn principal" :disabled="salvandoTreinamento">
          {{ salvandoTreinamento ? 'Salvando...' : 'Registrar treinamento' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Datas</th>
              <th>Instrutor</th>
              <th>Participantes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in treinamentos" :key="item.training_id">
              <td>{{ item.title }}</td>
              <td>{{ item.start_date }} - {{ item.end_date || item.start_date }}</td>
              <td>{{ item.instructor || '-' }}<br><small>{{ item.hours_total || 0 }} h</small></td>
              <td>
                <ul>
                  <li v-for="(p, idx) in item.participants || []" :key="idx">{{ p.nome }} - {{ p.funcao || '' }} ({{ p.organizacao || '' }})</li>
                </ul>
              </td>
            </tr>
            <tr v-if="!treinamentos.length">
              <td colspan="4">Sem treinamentos registrados.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Equipe e controle de validades</h2>
          <p>Cadastro dos responsáveis por função e status automático de validade do treinamento.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarPessoa">
        <label>
          Nome*
          <input type="text" v-model="formPessoa.name" required />
        </label>
        <label>
          Sobrenome*
          <input type="text" v-model="formPessoa.last_name" required />
        </label>
        <label>
          CPF*
          <input type="text" v-model="formPessoa.cpf" required placeholder="Somente numeros" />
        </label>
        <label>
          Funcao*
          <input type="text" v-model="formPessoa.role" required placeholder="EGRF, CTA, Mecanico..." />
        </label>
        <label>
          Organizacao
          <input type="text" v-model="formPessoa.organization" />
        </label>
        <label>
          E-mail*
          <input type="email" v-model="formPessoa.email" required />
        </label>
        <label>
          Telefone*
          <input type="text" v-model="formPessoa.phone" required />
        </label>
        <label class="wide">
          Notas
          <textarea rows="2" v-model="formPessoa.notes"></textarea>
        </label>
        <button class="btn principal" :disabled="salvandoPessoa">
          {{ salvandoPessoa ? 'Salvando...' : 'Adicionar pessoa' }}
        </button>
      </form>
      <div class="tabela">
        <h3>Status por função</h3>
        <table>
          <thead>
            <tr>
              <th>Função</th>
              <th>Total</th>
              <th>Válidos</th>
              <th>Expirados</th>
              <th>Pendentes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="linha in statusFuncoes" :key="linha.role">
              <td>{{ linha.role }}</td>
              <td>{{ linha.total }}</td>
              <td>{{ linha.validos }}</td>
              <td>{{ linha.expirados }}</td>
              <td>{{ linha.pendentes }}</td>
            </tr>
            <tr v-if="!statusFuncoes.length">
              <td colspan="5">Cadastre a equipe para visualizar o status.</td>
            </tr>
          </tbody>
        </table>
        <h3>Pendências e reciclagens</h3>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Função</th>
              <th>Status</th>
              <th>Validade</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pendenciasTreinamento" :key="item.personnel_id">
              <td>{{ item.name }}</td>
              <td>{{ item.role }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.valid_until || 'Sem validade' }}</td>
            </tr>
            <tr v-if="!pendenciasTreinamento.length">
              <td colspan="4">Nenhuma pendência recente.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Conclusões de treinamento</h2>
          <p>Associe cada pessoa ao treinamento realizado e validade configurada.</p>
        </div>
      </header>
      <form class="grid" @submit.prevent="salvarConclusao">
        <label>
          Pessoa*
          <select v-model="formConclusao.personnel_id" required>
            <option value="">Selecione</option>
            <option v-for="p in pessoal" :key="p.personnel_id" :value="p.personnel_id">{{ p.name }} - {{ p.role }}</option>
          </select>
        </label>
        <label>
          Treinamento
          <select v-model="formConclusao.training_id">
            <option value="">-</option>
            <option v-for="t in treinamentos" :key="t.training_id" :value="t.training_id">{{ t.title }}</option>
          </select>
        </label>
        <label>
          Data de conclusão*
          <input type="date" v-model="formConclusao.completion_date" required />
        </label>
        <label>
          Carga (h)
          <input type="number" min="0" step="0.5" v-model.number="formConclusao.hours" />
        </label>
        <label>
          Validade (meses)
          <input type="number" min="0" step="1" v-model.number="formConclusao.validity_months" />
        </label>
        <label>
          Status
          <select v-model="formConclusao.status">
            <option value="valido">Válido</option>
            <option value="expirado">Expirado</option>
            <option value="pendente">Pendente</option>
          </select>
        </label>
        <label class="wide">
          Link certificado
          <input type="url" v-model="formConclusao.certificate_url" />
        </label>
        <label class="wide">
          Notas
          <textarea rows="2" v-model="formConclusao.notes"></textarea>
        </label>
        <button class="btn principal" :disabled="salvandoConclusao">
          {{ salvandoConclusao ? 'Salvando...' : 'Registrar conclusão' }}
        </button>
      </form>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Função</th>
              <th>Treinamento</th>
              <th>Data</th>
              <th>Validade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in conclusoes" :key="item.completion_id">
              <td>{{ item.pessoa }}</td>
              <td>{{ item.role }}</td>
              <td>{{ item.treinamento || '-' }}</td>
              <td>{{ item.completion_date }}</td>
              <td>{{ item.valid_until || 'Sem validade' }}</td>
              <td>{{ item.status }}</td>
            </tr>
            <tr v-if="!conclusoes.length">
              <td colspan="6">Sem registros de conclusão.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Indicadores BAIST</h2>
          <p>Taxas e indicadores precursores conforme Guia BAIST / MCA 3-8.</p>
        </div>
        <form class="filtros" @submit.prevent="carregarKpis">
          <label>
            Início
            <input type="date" v-model="kpiFiltro.inicio" />
          </label>
          <label>
            Fim
            <input type="date" v-model="kpiFiltro.fim" />
          </label>
          <button class="btn" type="submit">Calcular</button>
        </form>
      </header>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>Aeroporto</th>
              <th>SR/10k</th>
              <th>ReAvi 10k</th>
              <th>ReASA 10k</th>
              <th>ReFau 10k</th>
              <th>ReAvi c/ dano (%)</th>
              <th>PeAvi</th>
              <th>PeFau</th>
              <th>Multiplas (%)</th>
              <th>Massa média (kg)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in kpisBaist" :key="row.airport_id">
              <td>{{ row.icao_code }}</td>
              <td>{{ formatNumber(row.sr10k) }}</td>
              <td>{{ formatNumber(row.reavi_10k) }}</td>
              <td>{{ formatNumber(row.reasa_10k) }}</td>
              <td>{{ formatNumber(row.refau_10k) }}</td>
              <td>{{ formatNumber(row.reavi_com_dano_pct) }}</td>
              <td>{{ formatNumber(row.peavi_por_movimento) }}</td>
              <td>{{ formatNumber(row.pefau_por_movimento) }}</td>
              <td>{{ formatNumber(row.pct_colisoes_multiplas) }}</td>
              <td>{{ formatNumber(row.massa_media_kg) }}</td>
            </tr>
            <tr v-if="!kpisBaist.length">
              <td colspan="10">Calcule o período desejado para visualizar os indicadores.</td>
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

const focos = ref<any[]>([]);
const comunicados = ref<any[]>([]);
const treinamentos = ref<any[]>([]);
const kpisBaist = ref<any[]>([]);
const pessoal = ref<any[]>([]);
const statusFuncoes = ref<any[]>([]);
const pendenciasTreinamento = ref<any[]>([]);
const conclusoes = ref<any[]>([]);

const formFoco = reactive({
  airport_id: 1,
  municipality: '',
  focus_type: '',
  description: '',
  distance_km: undefined as number | undefined,
  status: 'monitorado',
  responsible_org: '',
  protocol_ref: '',
  next_follow_up: ''
});
const salvandoFoco = ref(false);

const formComunicado = reactive({
  airport_id: 1,
  asa_focus_id: undefined as number | undefined,
  target_entity: '',
  subject: '',
  protocol_code: '',
  status: 'enviado',
  sent_at: '',
  response_due_at: '',
  notes: ''
});
const salvandoComunicado = ref(false);

const formTreinamento = reactive({
  airport_id: 1,
  title: '',
  audience: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  hours_total: undefined as number | undefined,
  instructor: ''
});
const topicosTexto = ref('');
const participantesTexto = ref('');
const salvandoTreinamento = ref(false);
const formPessoa = reactive({
  name: '',
  last_name: '',
  cpf: '',
  role: '',
  organization: '',
  email: '',
  phone: '',
  notes: ''
});
const salvandoPessoa = ref(false);
const formConclusao = reactive({
  training_id: '' as string | number | '',
  personnel_id: '' as string | number | '',
  completion_date: new Date().toISOString().slice(0, 10),
  hours: undefined as number | undefined,
  validity_months: 12,
  status: 'valido',
  certificate_url: '',
  notes: ''
});
const salvandoConclusao = ref(false);

const kpiFiltro = reactive({
  inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
  fim: new Date().toISOString().slice(0, 10)
});

function airportIdAtual() {
  return ApiService.getUser<any>()?.aeroporto_id ?? 1;
}

async function carregarFocos() {
  const data = await ApiService.getAsaFocos({ airportId: airportIdAtual() });
  focos.value = data;
}

async function salvarFoco() {
  salvandoFoco.value = true;
  try {
    await ApiService.criarAsaFoco({
      ...formFoco,
      airport_id: airportIdAtual()
    });
    Object.assign(formFoco, {
      municipality: '',
      focus_type: '',
      description: '',
      distance_km: undefined,
      status: 'monitorado',
      responsible_org: '',
      protocol_ref: '',
      next_follow_up: ''
    });
    await carregarFocos();
  } finally {
    salvandoFoco.value = false;
  }
}

async function carregarComunicados() {
  const data = await ApiService.getComunicadosExternos({ airportId: airportIdAtual() });
  comunicados.value = data;
}

async function salvarComunicado() {
  salvandoComunicado.value = true;
  try {
    await ApiService.criarComunicadoExterno({
      ...formComunicado,
      airport_id: airportIdAtual(),
      status: formComunicado.status || 'enviado'
    });
    Object.assign(formComunicado, {
      target_entity: '',
      subject: '',
      protocol_code: '',
      status: 'enviado',
      sent_at: '',
      response_due_at: '',
      notes: ''
    });
    await carregarComunicados();
  } finally {
    salvandoComunicado.value = false;
  }
}

async function carregarTreinamentos() {
  const data = await ApiService.getTreinamentos({ airportId: airportIdAtual() });
  treinamentos.value = data;
}

function parseParticipantes(texto: string) {
  if (!texto.trim()) return [];
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [nome = '', funcao = '', organizacao = ''] = linha.split('|').map((p) => p.trim());
      return { nome, funcao, organizacao };
    });
}

async function salvarTreinamento() {
  salvandoTreinamento.value = true;
  try {
    await ApiService.criarTreinamento({
      ...formTreinamento,
      airport_id: airportIdAtual(),
      topics: topicosTexto.value ? topicosTexto.value.split(',').map((t) => t.trim()).filter(Boolean) : [],
      participants: parseParticipantes(participantesTexto.value)
    });
    formTreinamento.title = '';
    formTreinamento.audience = '';
    formTreinamento.hours_total = undefined;
    formTreinamento.instructor = '';
    topicosTexto.value = '';
    participantesTexto.value = '';
    await carregarTreinamentos();
  } finally {
    salvandoTreinamento.value = false;
  }
}

async function carregarPessoal() {
  const data = await ApiService.getPessoal({ airportId: airportIdAtual() });
  pessoal.value = data;
}

async function salvarPessoa() {
  const obrigatorios = [
    formPessoa.name,
    formPessoa.last_name,
    formPessoa.cpf,
    formPessoa.role,
    formPessoa.email,
    formPessoa.phone
  ];
  if (obrigatorios.some((valor) => !valor || !String(valor).trim())) {
    alert('Preencha nome, sobrenome, CPF, funcao, e-mail e telefone.');
    return;
  }
  salvandoPessoa.value = true;
  try {
    await ApiService.criarPessoa({
      ...formPessoa,
      cpf: formPessoa.cpf.replace(/[^0-9]/g, ''),
      airport_id: airportIdAtual()
    });
    Object.assign(formPessoa, {
      name: '',
      last_name: '',
      cpf: '',
      role: '',
      organization: '',
      email: '',
      phone: '',
      notes: ''
    });
    await Promise.all([carregarPessoal(), carregarStatusTreinamentos()]);
  } catch (error: any) {
    console.error('Erro ao salvar pessoa', error);
    const mensagem = error?.response?.data?.mensagem ?? 'Falha ao salvar pessoa. Verifique os dados informados.';
    alert(mensagem);
  } finally {
    salvandoPessoa.value = false;
  }
}

async function carregarConclusoes() {
  const data = await ApiService.getTreinamentoConclusoes({ airportId: airportIdAtual() });
  conclusoes.value = data;
}

async function salvarConclusao() {
  if (!formConclusao.personnel_id) return;
  salvandoConclusao.value = true;
  try {
    await ApiService.criarTreinamentoConclusao({
      personnel_id: Number(formConclusao.personnel_id),
      training_id: formConclusao.training_id ? Number(formConclusao.training_id) : undefined,
      completion_date: formConclusao.completion_date,
      hours: formConclusao.hours ?? null,
      validity_months: formConclusao.validity_months ?? null,
      status: formConclusao.status || 'valido',
      certificate_url: formConclusao.certificate_url || null,
      notes: formConclusao.notes || null
    });
    Object.assign(formConclusao, {
      training_id: '',
      personnel_id: '',
      completion_date: new Date().toISOString().slice(0, 10),
      hours: undefined,
      validity_months: 12,
      status: 'valido',
      certificate_url: '',
      notes: ''
    });
    await Promise.all([carregarConclusoes(), carregarStatusTreinamentos()]);
  } finally {
    salvandoConclusao.value = false;
  }
}

async function carregarStatusTreinamentos() {
  const data = await ApiService.getStatusTreinamentos({ airportId: airportIdAtual() });
  statusFuncoes.value = data.statusPorFuncao ?? [];
  pendenciasTreinamento.value = data.pendencias ?? [];
}

async function carregarKpis() {
  const data = await ApiService.getKpisBaist({
    inicio: kpiFiltro.inicio,
    fim: kpiFiltro.fim,
    airportId: airportIdAtual()
  });
  kpisBaist.value = data.aeroportos ?? [];
}

function focoStatus(valor?: string) {
  const mapa: Record<string, string> = {
    monitorado: 'Monitorado',
    em_gestao: 'Em gestão',
    mitigado: 'Mitigado'
  };
  return mapa[valor || ''] || '-';
}

function comunicadoStatus(valor?: string) {
  const mapa: Record<string, string> = {
    enviado: 'Enviado',
    em_andamento: 'Em andamento',
    respondido: 'Respondido',
    encerrado: 'Encerrado'
  };
  return mapa[valor || ''] || '-';
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(2);
}

onMounted(async () => {
  await Promise.all([
    carregarFocos(),
    carregarComunicados(),
    carregarTreinamentos(),
    carregarKpis(),
    carregarPessoal(),
    carregarConclusoes(),
    carregarStatusTreinamentos()
  ]);
});
</script>

<style scoped>
.painel { display: flex; flex-direction: column; gap: 2rem; }
.bloco { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.bloco-topo { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
.grid label { display: flex; flex-direction: column; gap: .35rem; font-size: .9rem; }
.grid textarea, .grid input, .grid select { padding: .45rem .6rem; border: 1px solid #cbd5f5; border-radius: 6px; }
.grid .wide { grid-column: span 2; }
.btn { padding: .55rem 1.2rem; border: none; border-radius: 6px; background: #0f172a; color: #fff; cursor: pointer; }
.btn.principal { background: #0ea5e9; }
.tabela table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.tabela th, .tabela td { border-bottom: 1px solid #e5e7eb; padding: .6rem; vertical-align: top; }
.tabela th { text-align: left; background: #f8fafc; }
.filtros { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; }
.filtros label { display: flex; flex-direction: column; gap: .25rem; font-size: .9rem; }
@media (max-width: 768px) {
  .grid .wide { grid-column: span 1; }
}
</style>
