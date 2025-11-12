<template>
  <div class="grid" style="grid-template-columns: 3fr 2fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>ColisÃƒÂµes registradas</h3>
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
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem ColisÃƒÂµes">
          <template #date_br="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #location_nome="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #fase_nome="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #dano_nome="{ valor }">
            {{ valor ?? '-' }}
          </template>
          <template #acoes="{ linha }">
            <button class="btn btn-secondary" @click="editar(linha)">Editar</button>
          </template>          <template #evento_label="{ linha }">
            {{ linha ? (linha.event_type === 'colisÃƒÂ£o_outro_animal' ? 'ColisÃƒÆ’Ã‚Â£o (outro animal)' : (linha.event_type === 'quase_colisÃƒÂ£o' ? 'Quase-colisÃƒÆ’Ã‚Â£o' : 'ColisÃƒÆ’Ã‚Â£o (ave)')) : '-' }}
          </template>
          <template #periodo_label="{ linha }">
            {{ lookups.periodos_dia.find((p: any) => p.id === linha.time_period_id)?.name ?? '-' }}
          </template>
          <template #pilot_alerted_label="{ linha }">
            {{ linha.pilot_alerted == null ? '-' : (linha.pilot_alerted ? 'Sim' : 'NÃƒÆ’Ã‚Â£o') }}
          </template>
          <template #near_miss_label="{ linha }">
            {{ linha.near_miss == null ? '-' : (linha.near_miss ? 'Sim' : 'NÃƒÆ’Ã‚Â£o') }}
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div class="card">
      <header class="cabecalho">
        <h3>{{ editandoId ? 'Editar colisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o' : 'Registrar colisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o' }}</h3>
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
            <option value="N">N</option>
            <option value="NE">NE</option>
            <option value="E">E</option>
            <option value="SE">SE</option>
            <option value="S">S</option>
            <option value="SW">SW</option>
            <option value="W">W</option>
            <option value="NW">NW</option>
            <option value="Centro">Centro</option>
          </select>
        </label>
        <label>
          PerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odo
          <select v-model.number="novo.time_period_id">
            <option :value="undefined">Selecione</option>
            <option v-for="p in lookups.periodos_dia" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>
          Tipo de evento
          <select v-model="novo.event_type">
            <option value="colisÃƒÂ£o_ave">ColisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o com ave</option>
            <option value="colisÃƒÂ£o_outro_animal">ColisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o com outro animal</option>
            <option value="quase_colisÃƒÂ£o">Quase-colisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o</option>
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
          Visibilidade
          <select v-model.number="novo.vis_id">
            <option :value="undefined">Selecione</option>
            <option v-for="v in lookups.visibilidade" :key="v.id" :value="v.id">{{ v.name }}</option>
          </select>
        </label>
        <label>
          Vento
          <select v-model.number="novo.wind_id">
            <option :value="undefined">Selecione</option>
            <option v-for="v in lookups.vento" :key="v.id" :value="v.id">{{ v.name }}</option>
          </select>
        </label>
        <label>
          PrecipitaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
          <select v-model.number="novo.precip_id">
            <option :value="undefined">Selecione</option>
            <option v-for="p in lookups.precipitacao" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>
          EspÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cie
          <select v-model.number="novo.species_id">
            <option :value="undefined">NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o identificada</option>
            <option v-for="e in especies" :key="e.id" :value="e.id">{{ e.common_name }}</option>
          </select>
        </label>
        <label>
          Quantidade
          <input type="number" min="1" v-model.number="novo.quantity" />
        </label>
        <label>
          ConfianÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a na identificaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
          <select v-model="novo.id_confidence">
            <option :value="undefined">Selecione</option>
            <option value="Alta">Alta</option>
            <option value="Media">MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia</option>
            <option value="Baixa">Baixa</option>
            <option value="Nao_identificada">NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o identificada</option>
          </select>
        </label>
        <label>
          Gravidade
          <select v-model.number="novo.damage_id">
            <option :value="undefined">Sem dano</option>
            <option v-for="d in lookups.classes_dano" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>
        <label>
          Altura do impacto (AGL, m)
          <input type="number" min="0" step="1" v-model.number="novo.impact_height_agl_m" />
        </label>
        <label>
          Velocidade da aeronave (kt)
          <input type="number" min="0" step="1" v-model.number="novo.aircraft_speed_kt" />
        </label>
        <label>
          ConsequÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia operacional
          <input type="text" v-model="novo.operational_consequence" />
        </label>
        <label>
          Danos visÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­veis (notas)
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
          Quase-colisÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
          <input type="checkbox" v-model="novo.near_miss" />
        </label>
        <label>
          MatrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­cula da aeronave
          <input type="text" v-model="novo.aircraft_registration" />
        </label>
        <label>
          Tipo de aeronave
          <input type="text" v-model="novo.aircraft_type" />
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
          CarcaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a encontrada
          <input type="checkbox" v-model="novo.carcass_found" />
        </label>
        <label>
          AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes tomadas
          <textarea rows="2" v-model="novo.actions_taken"></textarea>
        </label>
        <label>
          Foto (URL)
          <input type="url" v-model="novo.photo_url" />
        </label>
        <label>
          Dentro do aerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³dromo
          <input type="checkbox" v-model="novo.inside_aerodrome" />
        </label>
        <label>
          Atrativo relacionado
          <select v-model.number="novo.related_attractor_id">
            <option :value="undefined">Nenhum</option>
            <option v-for="a in atrativos" :key="a.id" :value="a.id">{{ a.description || ('Atrativo #' + a.id) }}</option>
          </select>
        </label>
        <label>
          Notas de gestÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o de risco
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
import { ref, onMounted, watch } from 'vue';
import DataTable from '@/components/DataTable.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService, api } from '@/services/api';

const colunas = [
  { titulo: 'Data', campo: 'date_br' },
  { titulo: 'Hora', campo: 'time_local' },
  { titulo: 'Local', campo: 'location_nome' },
  { titulo: 'Evento', campo: 'evento_label' },
  { titulo: 'PerÃƒÂ­odo', campo: 'periodo_label' },
  { titulo: 'Fase', campo: 'fase_nome' },
  { titulo: 'Dano', campo: 'dano_nome' },
  { titulo: 'Piloto alertado', campo: 'pilot_alerted_label' },
  { titulo: 'Quase-colisÃƒÂ£o', campo: 'near_miss_label' },
  { titulo: 'Atrativo', campo: 'related_attractor_desc' },
  { titulo: 'Notas', campo: 'notes' },
  { titulo: 'AÃƒÂ§ÃƒÂµes', campo: 'acoes' }
];

const filtros = ref<{ airportId?: number; fase?: number }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ fases_voo: [], classes_dano: [], visibilidade: [], vento: [], precipitacao: [], tipos_motor: [], periodos_dia: [], partes_aeronave: [], classes_massa: [] });
const locais = ref<any[]>([]);
const atrativos = ref<any[]>([]);
const especies = ref<any[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);
const novo = ref({
  airport_id: '' as any,
  location_id: '' as any,
  date_utc: '',
  time_local: '',
  time_period_id: undefined as any,
  event_type: 'colisÃƒÂ£o_ave',
  latitude_dec: undefined as any,
  longitude_dec: undefined as any,
  quadrant: undefined as any,
  phase_id: undefined as any,
  vis_id: undefined as any,
  wind_id: undefined as any,
  precip_id: undefined as any,
  species_id: undefined as any,
  quantity: undefined as any,
  id_confidence: undefined as any,
  damage_id: undefined as any,
  engine_type_id: undefined as any,
  near_miss: false,
  pilot_alerted: false,
  aircraft_registration: '',
  aircraft_type: '',
  impact_height_agl_m: undefined as any,
  aircraft_speed_kt: undefined as any,
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
  notes: ''
});
const editandoId = ref<number | null>(null);
const partesSelecionadas = ref<number[]>([]);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getColisoes(filtros.value);
    const mapEvento = (tipo: string | undefined) => {
      if (tipo === 'colisao_outro_animal') return 'ColisÃ£o (outro animal)';
      if (tipo === 'quase_colisao') return 'Quase-colisÃ£o';
      return 'ColisÃ£o (ave)';
    };
    lista.value = dados.map((item: any) => ({
      ...item,
      date_br: item.date_utc ? new Date(item.date_utc).toLocaleDateString('pt-BR') : null,
      fase_nome: lookups.value.fases_voo.find((f: any) => f.id === item.phase_id)?.name ?? null,
      dano_nome: lookups.value.classes_dano.find((d: any) => d.id === item.damage_id)?.name ?? null,
      evento_label: mapEvento(item.event_type),
      periodo_label: lookups.value.periodos_dia.find((p: any) => p.id === item.time_period_id)?.name ?? null,
      pilot_alerted_label: item.pilot_alerted == null ? null : (item.pilot_alerted ? 'Sim' : 'NÃ£o'),
      near_miss_label: item.near_miss == null ? null : (item.near_miss ? 'Sim' : 'NÃ£o')
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar colisoes';
  } finally {
    carregando.value = false;
  }
}

watch(
  () => novo.value.airport_id,
  () => {
    carregarLocais();
  }
);

onMounted(async () => {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos;
  especies.value = cad.especies;
  lookups.value = cad.lookups;
  carregar();
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
  flex-wrap: wrap;
  gap: 1rem;
}

.form {
  flex-direction: column;
}

select,
input,
textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}
</style>



