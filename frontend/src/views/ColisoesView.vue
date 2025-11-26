<template>
  <div class="grid" style="grid-template-columns: 3fr 2fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Colisões registradas</h3>
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
          Fase do voo
          <select v-model.number="filtros.fase">
            <option :value="undefined">Todas</option>
            <option v-for="fase in lookups.fases_voo" :key="fase.id" :value="fase.id">{{ fase.name }}</option>
          </select>
        </label>
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem colisões">
          <template #date_br="{ valor }">{{ valor ?? '-' }}</template>
          <template #location_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #fase_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #dano_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #evento_label="{ linha }">
            {{ linha ? (linha.event_type === 'colisao_outro_animal' ? 'Colisão (outro animal)' : (linha.event_type === 'quase_colisao' ? 'Quase-colisão' : 'Colisão (ave)')) : '-' }}
          </template>
          <template #periodo_label="{ linha }">
            {{ lookups.periodos_dia.find((p: any) => p.id === linha.time_period_id)?.name ?? '-' }}
          </template>
          <template #pilot_alerted_label="{ linha }">{{ linha.pilot_alerted == null ? '-' : (linha.pilot_alerted ? 'Sim' : 'Não') }}</template>
          <template #near_miss_label="{ linha }">{{ linha.near_miss == null ? '-' : (linha.near_miss ? 'Sim' : 'Não') }}</template>
          <template #foto_info="{ valor }">{{ valor ?? '-' }}</template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div class="card">
      <header class="cabecalho">
        <h3>{{ editandoId ? 'Editar colisão' : 'Registrar colisão' }}</h3>
        <button v-if="editandoId" class="btn btn-secondary" type="button" @click="cancelarEdicao">Cancelar</button>
      </header>
      <form class="form" @submit.prevent="salvar">
        <label>
          Aeroporto
          <select v-model.number="novo.airport_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>
          Local
          <select v-model.number="novo.location_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="l in locais" :key="l.id" :value="l.id">{{ l.code }}</option>
          </select>
        </label>
        <label>
          Data
          <input type="date" lang="pt-BR" v-model="novo.date_utc" required />
        </label>
        <label>
          Hora
          <input type="time" v-model="novo.time_local" required />
        </label>
        <label>
          Latitude
          <input type="number" step="0.000001" v-model.number="novo.latitude_dec" />
        </label>
        <label>
          Longitude
          <input type="number" step="0.000001" v-model.number="novo.longitude_dec" />
        </label>
        <label>
          Quadrante
          <select v-model="novo.quadrant">
            <option :value="undefined">Selecione</option>
            <option v-for="q in quadrantes" :key="q.code" :value="q.code">
              {{ q.description ? q.code + ' - ' + q.description : q.code }}
            </option>
          </select>
        </label>
        <div class="map-card">
          <QuadrantMapPicker :selected="novo.quadrant ?? ''" @select="aplicarQuadrante" />
        </div>
        <label>
          Período
          <select v-model.number="novo.time_period_id">
            <option :value="undefined">Selecione</option>
            <option v-for="p in lookups.periodos_dia" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>
          Tipo de evento
          <select v-model="novo.event_type">
            <option value="colisao_ave">Colisão com ave</option>
            <option value="colisao_outro_animal">Colisão com outro animal</option>
            <option value="quase_colisao">Quase-colisão</option>
          </select>
        </label>
        <label>
          Fase
          <select v-model.number="novo.phase_id">
            <option :value="undefined">Selecione</option>
            <option v-for="fase in lookups.fases_voo" :key="fase.id" :value="fase.id">{{ fase.name }}</option>
          </select>
        </label>
        <label>
          Condições do céu
          <select v-model="novo.sky_condition">
            <option :value="undefined">Selecione</option>
            <option v-for="cond in opcoesCeu" :key="cond.value" :value="cond.value">
              {{ cond.label }}
            </option>
          </select>
        </label>
        <label>
          Precipitação
          <select v-model="novo.precip_condition">
            <option :value="undefined">Selecione</option>
            <option v-for="p in opcoesPrecipitacao" :key="p.value" :value="p.value">
              {{ p.label }}
            </option>
          </select>
        </label>
        <label>
          Espécie
          <select v-model.number="novo.species_id">
            <option :value="undefined">Não identificada</option>
            <option v-for="e in especies" :key="e.id" :value="e.id">{{ e.common_name }}</option>
          </select>
        </label>
        <label>
          Quantidade
          <input type="number" min="1" v-model.number="novo.quantity" />
        </label>
        <label>
          Gravidade
          <select v-model.number="novo.damage_id">
            <option :value="undefined">Sem dano</option>
            <option v-for="d in lookups.classes_dano" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>
        <label>
          Consequência operacional
          <input type="text" v-model="novo.operational_consequence" />
        </label>
        <label>
          Danos visíveis (notas)
          <input type="text" v-model="novo.visible_damage_notes" />
        </label>
        <label>
          Partes atingidas
          <select v-model="partesSelecionadas" multiple>
            <option v-for="p in lookups.partes_aeronave" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>
          Piloto alertado
          <input type="checkbox" v-model="novo.pilot_alerted" />
        </label>
        <label>
          Quase-colisão
          <input type="checkbox" v-model="novo.near_miss" />
        </label>
        <label>
          Matrícula da aeronave
          <input type="text" v-model="novo.aircraft_registration" />
        </label>
        <label>
          Modelo cadastrado
          <select v-model="novo.aircraft_model_id">
            <option :value="null">Selecione</option>
            <option v-for="a in aeronaves" :key="a.id" :value="a.id">
              {{ a.manufacturer }} {{ a.model }}{{ a.category ? ` - ${a.category}` : '' }}
            </option>
          </select>
        </label>
        <div class="aeronave-resumo" v-if="modeloSelecionado">
          <p><strong>Motor catálogo:</strong> {{ nomeMotorPorId(modeloSelecionado.engine_type_id) }}</p>
          <p>
            <span v-if="modeloSelecionado.wingspan_m">Envergadura: {{ modeloSelecionado.wingspan_m }} m</span>
            <span v-if="modeloSelecionado.length_m"> · Comprimento: {{ modeloSelecionado.length_m }} m</span>
          </p>
        </div>
        <label>
          Tipo de aeronave
          <input type="text" v-model="novo.aircraft_type" placeholder="Descrição livre, se necessário" />
        </label>
        <label>
          Tipo de motor
          <select v-model.number="novo.engine_type_id">
            <option :value="undefined">Selecione</option>
            <option v-for="t in lookups.tipos_motor" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label>
          Investigado por
          <input type="text" v-model="novo.investigated_by" />
        </label>
        <label>
          Carcaça encontrada
          <input type="checkbox" v-model="novo.carcass_found" />
        </label>
        <label>
          Ações tomadas
          <textarea rows="2" v-model="novo.actions_taken"></textarea>
        </label>
        <div class="foto-section">
          <div class="foto-modos">
            <label>
              <input type="radio" value="upload" v-model="modoFoto" /> Upload do computador
            </label>
            <label>
              <input type="radio" value="url" v-model="modoFoto" /> Informar URL
            </label>
          </div>
          <div v-if="modoFoto === 'upload'" class="foto-preview">
            <input :key="fileInputKey" type="file" accept="image/*" multiple @change="selecionarFotos" />
            <div v-if="fotoServidorDisponivel && !fotosPreview.length" class="foto-status">
              Imagem enviada anteriormente armazenada no servidor.
            </div>
            <div v-if="fotosPreview.length" class="fotos-preview-list">
              <div class="foto-thumb-item" v-for="(preview, idx) in fotosPreview" :key="preview">
                <img :src="preview" alt="Pré-visualização" />
                <button class="btn btn-secondary" type="button" @click="removerFoto(idx)">Remover</button>
              </div>
            </div>
          </div>
          <div v-else class="foto-url">
            <input type="url" v-model="novo.photo_url" placeholder="https://exemplo.com/foto.jpg" />
            <small>Use links HTTPS acessíveis externamente.</small>
          </div>
        </div>
        <div class="campo-atraso">
          <span>Causou atraso no voo?</span>
          <label><input type="radio" value="sim" v-model="flightDelayChoice" /> Sim</label>
          <label><input type="radio" value="nao" v-model="flightDelayChoice" /> Não</label>
        </div>
        <label v-if="flightDelayChoice === 'sim'">
          Tempo de atraso (minutos)
          <input type="number" min="0" step="1" v-model.number="novo.delay_minutes" />
        </label>
        <div class="custos-grid">
          <label>
            Custo direto (R$)
            <input type="number" min="0" step="0.01" v-model.number="novo.custos.direto" />
          </label>
          <label>
            Custo indireto (R$)
            <input type="number" min="0" step="0.01" v-model.number="novo.custos.indireto" />
          </label>
          <label>
            Outros custos (R$)
            <input type="number" min="0" step="0.01" v-model.number="novo.custos.outros" />
          </label>
        </div>
        <label>
          Dentro do aeródromo
          <input type="checkbox" v-model="novo.inside_aerodrome" />
        </label>
        <label>
          Localização no aeródromo
          <select v-model.number="novo.aerodrome_location_id">
            <option :value="undefined">Selecione</option>
            <option v-for="loc in lookups.locais_aerodromo" :key="loc.id" :value="loc.id">
              {{ loc.name }}
            </option>
          </select>
        </label>
        <label>
          Fase da ocorrência
          <select v-model.number="novo.occurrence_phase_id">
            <option :value="undefined">Selecione</option>
            <option v-for="fase in lookups.fases_ocorrencia" :key="fase.id" :value="fase.id">
              {{ fase.name }}
            </option>
          </select>
        </label>
        <label>
          Atrativo relacionado
          <select v-model.number="novo.related_attractor_id">
            <option :value="undefined">Nenhum</option>
            <option v-for="a in atrativos" :key="a.id" :value="a.id">{{ a.description || ('Atrativo #' + a.id) }}</option>
          </select>
        </label>
        <label>
          Notas de gestão de risco
          <textarea rows="2" v-model="novo.risk_mgmt_notes"></textarea>
        </label>
        <label>
          Porte estimado (massa)
          <select v-model.number="novo.est_mass_id">
            <option :value="undefined">Selecione</option>
            <option v-for="m in lookups.classes_massa" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <label>
          Massa estimada (g)
          <input type="number" min="0" step="1" v-model.number="novo.est_mass_grams" />
        </label>
        <label>
          Nome do relator
          <input type="text" v-model="novo.reporter_name" />
        </label>
        <label>
          Contato do relator
          <input type="text" v-model="novo.reporter_contact" />
        </label>
        <label>
          Notas
          <textarea rows="2" v-model="novo.notes"></textarea>
        </label>
        <button class="btn btn-primary" type="submit">{{ editandoId ? 'Atualizar' : 'Salvar' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import QuadrantMapPicker from '@/components/QuadrantMapPicker.vue';
import DataTable from '@/components/DataTable.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService, api } from '@/services/api';
import type { QuadrantSelection } from '@/config/quadrantGrid';

const opcoesCeu = [
  { value: 'claro', label: 'Claro' },
  { value: 'poucas_nuvens', label: 'Poucas nuvens' },
  { value: 'encoberto', label: 'Encoberto' }
] as const;

const opcoesPrecipitacao = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'nevoeiro', label: 'Nevoeiro' },
  { value: 'chuva', label: 'Chuva' },
  { value: 'chuva_recente', label: 'Chuva recente' }
] as const;

const colunas = [
  { titulo: 'Data', campo: 'date_br' },
  { titulo: 'Hora', campo: 'time_local' },
  { titulo: 'Local', campo: 'location_nome' },
  { titulo: 'Evento', campo: 'evento_label' },
  { titulo: 'Período', campo: 'periodo_label' },
  { titulo: 'Fase', campo: 'fase_nome' },
  { titulo: 'Dano', campo: 'dano_nome' },
  { titulo: 'Aeronave', campo: 'aircraft_type' },
  { titulo: 'Piloto alertado', campo: 'pilot_alerted_label' },
  { titulo: 'Quase-colisão', campo: 'near_miss_label' },
  { titulo: 'Atrativo', campo: 'related_attractor_desc' },
  { titulo: 'Foto', campo: 'foto_info' },
  { titulo: 'Notas', campo: 'notes' },
  { titulo: 'Ações', campo: 'acoes' }
];

const filtros = ref<{ airportId?: number; fase?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({
  fases_voo: [],
  classes_dano: [],
  visibilidade: [],
  vento: [],
  precipitacao: [],
  tipos_motor: [],
  periodos_dia: [],
  partes_aeronave: [],
  classes_massa: [],
  locais_aerodromo: [],
  fases_ocorrencia: []
});
const locais = ref<any[]>([]);
const atrativos = ref<any[]>([]);
const especies = ref<any[]>([]);
const aeronaves = ref<any[]>([]);
const quadrantes = ref<any[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);

function criarEstadoNovo() {
  return {
    airport_id: '' as any,
    location_id: '' as any,
    date_utc: '',
    time_local: '',
    time_period_id: undefined as any,
    event_type: 'colisao_ave',
    latitude_dec: undefined as any,
    longitude_dec: undefined as any,
    quadrant: undefined as any,
    phase_id: undefined as any,
    sky_condition: undefined as any,
    precip_condition: undefined as any,
    species_id: undefined as any,
    quantity: undefined as any,
    damage_id: undefined as any,
    aircraft_model_id: null as any,
    engine_type_id: undefined as any,
    near_miss: false,
    pilot_alerted: false,
    flight_delay: false,
    delay_minutes: undefined as number | undefined,
    aircraft_registration: '',
    aircraft_type: '',
    aerodrome_location_id: undefined as any,
    occurrence_phase_id: undefined as any,
    operational_consequence: '',
    visible_damage_notes: '',
    investigated_by: '',
    carcass_found: false,
    actions_taken: '',
    photo_url: '',
    inside_aerodrome: false,
    related_attractor_id: undefined as any,
    risk_mgmt_notes: '',
    est_mass_id: undefined as any,
    est_mass_grams: undefined as any,
    reporter_name: '',
    reporter_contact: '',
    custos: {
      direto: null as number | null,
      indireto: null as number | null,
      outros: null as number | null
    },
    notes: ''
  };
}

function aplicarModeloSelecionado(id: number) {
  const modelo = aeronaves.value.find((item: any) => item.id === id);
  if (!modelo) return;
  novo.value.aircraft_type = `${modelo.manufacturer} ${modelo.model}`;
  if (modelo.engine_type_id) {
    novo.value.engine_type_id = modelo.engine_type_id;
  }
}

function nomeMotorPorId(id?: number | null) {
  if (!id) return '-';
  return lookups.value.tipos_motor?.find((item: any) => item.id === id)?.name ?? '-';
}

const novo = ref<any>(criarEstadoNovo());
const modeloSelecionado = computed(() => {
  if (!novo.value.aircraft_model_id) return null;
  return aeronaves.value.find((item: any) => item.id === novo.value.aircraft_model_id) ?? null;
});
const editandoId = ref<number | null>(null);
const partesSelecionadas = ref<number[]>([]);
const fotosArquivos = ref<File[]>([]);
const fotosPreview = ref<string[]>([]);
const fotoServidorDisponivel = ref(false);
const fileInputKey = ref(0);
const modoFoto = ref<'upload' | 'url'>('upload');
const flightDelayChoice = ref<'sim' | 'nao'>('nao');

function limparFotosLocais() {
  for (const preview of fotosPreview.value) {
    URL.revokeObjectURL(preview);
  }
  fotosArquivos.value = [];
  fotosPreview.value = [];
  fileInputKey.value += 1;
}

function selecionarFotos(event: Event) {
  const alvo = event.target as HTMLInputElement;
  const arquivos = Array.from(alvo.files ?? []);
  limparFotosLocais();
  fotosArquivos.value = arquivos;
  fotosPreview.value = arquivos.map((arquivo) => URL.createObjectURL(arquivo));
  fotoServidorDisponivel.value = false;
}

function removerFoto(index: number) {
  const preview = fotosPreview.value[index];
  if (preview) {
    URL.revokeObjectURL(preview);
  }
  fotosArquivos.value.splice(index, 1);
  fotosPreview.value.splice(index, 1);
}

function aplicarQuadrante(selecao: QuadrantSelection) {
  novo.value.quadrant = selecao.quadrant;
  if (selecao.latitude !== null) {
    novo.value.latitude_dec = selecao.latitude;
  }
  if (selecao.longitude !== null) {
    novo.value.longitude_dec = selecao.longitude;
  }
}

function montarCorpoComArquivo(dados: Record<string, any>) {
  if (!fotosArquivos.value.length) {
    return dados;
  }
  const formData = new FormData();
  formData.append('dados', JSON.stringify(dados));
  for (const arquivo of fotosArquivos.value) {
    formData.append('foto', arquivo);
  }
  return formData;
}

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getColisoes(filtros.value);
    lista.value = dados.map((item: any) => ({
      ...item,
      date_br: item.date_utc ? new Date(item.date_utc).toLocaleDateString('pt-BR') : null,
      fase_nome: lookups.value.fases_voo.find((f: any) => f.id === item.phase_id)?.name ?? null,
      dano_nome: lookups.value.classes_dano.find((d: any) => d.id === item.damage_id)?.name ?? null,
      evento_label:
        item.event_type === 'colisao_outro_animal'
          ? 'Colisão (outro animal)'
          : item.event_type === 'quase_colisao'
            ? 'Quase-colisão'
            : 'Colisão (ave)',
      periodo_label: lookups.value.periodos_dia.find((p: any) => p.id === item.time_period_id)?.name ?? null,
      pilot_alerted_label: item.pilot_alerted == null ? null : item.pilot_alerted ? 'Sim' : 'Não',
      near_miss_label: item.near_miss == null ? null : item.near_miss ? 'Sim' : 'Não',
      foto_info: item.photo_upload_disponivel ? 'Arquivo' : item.photo_url ? 'URL' : '-'
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar colisões';
  } finally {
    carregando.value = false;
  }
}

async function carregarLocais() {
  if (!novo.value.airport_id) {
    locais.value = [];
    atrativos.value = [];
    return;
  }
  try {
    const user = ApiService.getUser<any>();
    if (user?.aeroporto_id && user.aeroporto_id !== novo.value.airport_id) {
      await ApiService.switchAirport(novo.value.airport_id);
    }
  } catch {}
  locais.value = await ApiService.getLocaisPorAeroporto(novo.value.airport_id);
  atrativos.value = await ApiService.getAtrativosPorAeroporto(novo.value.airport_id);
}

async function salvar() {
  try {
    const payload = { ...novo.value, parts: partesSelecionadas.value } as any;
    if (modoFoto.value === 'upload') {
      delete payload.photo_url;
    } else if (payload.photo_url) {
      payload.photo_url = (payload.photo_url as string).trim();
    }
    if (payload.aircraft_model_id !== undefined && payload.aircraft_model_id !== null && payload.aircraft_model_id !== '') {
      payload.aircraft_model_id = Number(payload.aircraft_model_id);
    } else {
      payload.aircraft_model_id = null;
    }
    const corpo = montarCorpoComArquivo(payload);
    if (editandoId.value) {
      await api.put(`/colisoes/${editandoId.value}`, corpo);
    } else {
      await api.post('/colisoes', corpo);
    }
    await carregar();
    resetarFormulario();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function resetarFormulario(manterAeroporto = true) {
  const aeroportoAtual = manterAeroporto ? novo.value.airport_id : '';
  editandoId.value = null;
  partesSelecionadas.value = [];
  novo.value = criarEstadoNovo();
  if (manterAeroporto) {
    novo.value.airport_id = aeroportoAtual;
  }
  locais.value = [];
  atrativos.value = [];
  limparFotosLocais();
  fotoServidorDisponivel.value = false;
  modoFoto.value = 'upload';
  flightDelayChoice.value = novo.value.flight_delay ? 'sim' : 'nao';
}

function cancelarEdicao() {
  resetarFormulario(false);
}

async function editar(registro: any) {
  editandoId.value = registro.id;
  novo.value = {
    airport_id: registro.airport_id,
    location_id: registro.location_id,
    date_utc: registro.date_utc?.slice(0, 10) ?? '',
    time_local: registro.time_local ?? '',
    time_period_id: registro.time_period_id,
    event_type: registro.event_type ?? 'colisao_ave',
    latitude_dec: registro.latitude_dec,
    longitude_dec: registro.longitude_dec,
    quadrant: registro.quadrant,
    phase_id: registro.phase_id,
    sky_condition: registro.sky_condition ?? undefined,
    precip_condition: registro.precip_condition ?? undefined,
    species_id: registro.species_id,
    quantity: registro.quantity,
    damage_id: registro.damage_id,
    aircraft_model_id: registro.aircraft_model_id ?? null,
    engine_type_id: registro.engine_type_id,
    near_miss: !!registro.near_miss,
    pilot_alerted: !!registro.pilot_alerted,
    aircraft_registration: registro.aircraft_registration ?? '',
    aerodrome_location_id: registro.aerodrome_location_id,
    occurrence_phase_id: registro.occurrence_phase_id,
    aircraft_type: registro.aircraft_type ?? '',
    operational_consequence: registro.operational_consequence ?? '',
    visible_damage_notes: registro.visible_damage_notes ?? '',
    investigated_by: registro.investigated_by ?? '',
    carcass_found: !!registro.carcass_found,
    actions_taken: registro.actions_taken ?? '',
    photo_url: registro.photo_url ?? '',
    inside_aerodrome: !!registro.inside_aerodrome,
    related_attractor_id: registro.related_attractor_id,
    risk_mgmt_notes: registro.risk_mgmt_notes ?? '',
    est_mass_id: registro.est_mass_id,
    est_mass_grams: registro.est_mass_grams,
    reporter_name: registro.reporter_name ?? '',
    reporter_contact: registro.reporter_contact ?? '',
    custos: {
      direto: registro.custo_direto ?? null,
      indireto: registro.custo_indireto ?? null,
      outros: registro.custo_outros ?? null
    },
    notes: registro.notes ?? ''
  } as any;
  novo.value.flight_delay = !!registro.flight_delay;
  novo.value.delay_minutes = registro.delay_minutes ?? undefined;
  flightDelayChoice.value = novo.value.flight_delay ? 'sim' : 'nao';
  await carregarLocais();
  if (registro.photo_upload_disponivel) {
    modoFoto.value = 'upload';
    fotoServidorDisponivel.value = true;
    novo.value.photo_url = '';
  } else if (registro.photo_url) {
    modoFoto.value = 'url';
    fotoServidorDisponivel.value = false;
  } else {
    modoFoto.value = 'upload';
    fotoServidorDisponivel.value = false;
    novo.value.photo_url = '';
  }
  limparFotosLocais();
}

watch(
  () => novo.value.aircraft_model_id,
  (valor) => {
    if (valor === '' || valor === undefined) {
      novo.value.aircraft_model_id = null;
      return;
    }
    if (valor === null) {
      return;
    }
    if (typeof valor === 'string') {
      const convertido = Number(valor);
      if (Number.isFinite(convertido)) {
        novo.value.aircraft_model_id = convertido;
      } else {
        novo.value.aircraft_model_id = null;
      }
      return;
    }
    aplicarModeloSelecionado(valor);
  }
);

watch(
  () => novo.value.airport_id,
  () => {
    carregarLocais();
  }
);

watch(modoFoto, (valor) => {
  if (valor === 'upload') {
    novo.value.photo_url = '';
  } else {
    limparFotosLocais();
    fotoServidorDisponivel.value = false;
  }
});

watch(flightDelayChoice, (valor) => {
  if (valor === 'sim') {
    novo.value.flight_delay = true;
  } else {
    novo.value.flight_delay = false;
    novo.value.delay_minutes = undefined;
  }
});

onMounted(async () => {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos;
  especies.value = cad.especies;
  lookups.value = cad.lookups;
  quadrantes.value = cad.quadrantes ?? [];
  aeronaves.value = cad.aeronaves ?? [];
  const user = ApiService.getUser<any>();
  if (user?.aeroporto_id) {
    novo.value.airport_id = user.aeroporto_id;
    filtros.value.airportId = user.aeroporto_id;
    await carregarLocais();
  }
  carregar();
});

onBeforeUnmount(() => {
  limparFotosLocais();
});
</script>

<style scoped>
.cabecalho { display: flex; justify-content: space-between; align-items: center; }
.filtros, .form { display: flex; flex-wrap: wrap; gap: 1rem; }
.form { flex-direction: column; }
select, input, textarea { padding: 0.45rem 0.5rem; border: 1px solid #cbd5f5; border-radius: 8px; }
.foto-preview { display: flex; flex-direction: column; gap: .5rem; font-size: .85rem; color: #475569; }
.fotos-preview-list { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: .5rem; }
.foto-thumb-item { width: 120px; display: flex; flex-direction: column; gap: .35rem; }
.foto-thumb-item img { width: 100%; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #dbeafe; }
.foto-thumb-item button { font-size: .75rem; padding: .25rem .35rem; }
.foto-section { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; background: #f8fafc; }
.foto-modos { display: flex; gap: 1rem; font-size: 0.85rem; color: #475569; }
.foto-modos input { margin-right: 0.35rem; }
.foto-url small { display: block; margin-top: 0.25rem; color: #94a3b8; }
.map-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.75rem; background: #f8fafc; }
.campo-atraso { display: flex; gap: 1rem; align-items: center; font-size: .85rem; }
.campo-atraso span { font-weight: 600; color: #0f172a; }
.custos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; }
.aeronave-resumo { font-size: 0.85rem; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.75rem; }
.aeronave-resumo p { margin: 0.15rem 0; }
</style>

