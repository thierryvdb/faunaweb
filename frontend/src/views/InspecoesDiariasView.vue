<template>
  <div class="inspecoes-diarias-container">
    <h1 class="page-title">Inspeções Diárias - Monitoramento de Fauna (F1)</h1>
    <p class="subtitle">Periodicidade: 2 vezes ao dia | Registre presença de fauna, riscos, colisões, ninhos, carcaças e ações de manejo</p>

    <div class="two-column-layout">
      <!-- Lista de Inspeções -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Inspeções Registradas</h2>
          <button @click="novaInspecao" class="btn btn-primary">+ Nova Inspeção</button>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label>Período:</label>
            <input type="date" v-model="filtros.inicio" />
            <span>até</span>
            <input type="date" v-model="filtros.fim" />
          </div>
          <button @click="carregarInspecoes" class="btn btn-secondary">Filtrar</button>
          <button @click="exportarPDF" class="btn btn-secondary">📄 Exportar PDF</button>
        </div>

        <div class="inspection-list">
          <div
            v-for="insp in inspecoes"
            :key="insp.inspection_id"
            :class="['inspection-card', { active: inspecaoSelecionada?.inspection_id === insp.inspection_id }]"
            @click="editarInspecao(insp)"
          >
            <div class="inspection-header">
              <strong>{{ formatarData(insp.inspection_date) }} - {{ insp.inspection_time }}</strong>
              <span class="badge">{{ insp.period_name || insp.period_text || 'N/A' }}</span>
            </div>
            <div class="inspection-details">
              <p><small>{{ insp.airport_name }} ({{ insp.icao_code }})</small></p>
              <p v-if="insp.collision_occurred" class="alert-collision">⚠️ Colisão ocorrida</p>
              <p v-if="insp.mandatory_report" class="alert-report">📋 Reporte mandatório</p>
            </div>
            <div class="inspection-actions">
              <button @click.stop="removerInspecao(insp.inspection_id)" class="btn-danger-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Formulário de Inspeção -->
      <div class="right-column">
        <form @submit.prevent="salvarInspecao" class="inspection-form">
          <h3>{{ modoEdicao ? 'Editar Inspeção' : 'Nova Inspeção' }}</h3>

          <!-- Seção 1: Informações Gerais -->
          <section class="form-section">
            <h4>1. Informações Gerais do Registro</h4>

            <div class="form-row">
              <div class="form-group">
                <label>Aeroporto *</label>
                <select v-model="form.airport_id" required>
                  <option value="">Selecione...</option>
                  <option v-for="a in aeroportos" :key="a.airport_id" :value="a.airport_id">
                    {{ a.icao_code }} - {{ a.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Data *</label>
                <input type="date" v-model="form.inspection_date" required />
              </div>
              <div class="form-group">
                <label>Horário *</label>
                <input type="time" v-model="form.inspection_time" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Período da Observação</label>
                <select v-model="form.period_id">
                  <option value="">Selecione...</option>
                  <option v-for="p in lookups.periodos_inspecao" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Período (texto livre)</label>
                <input type="text" v-model="form.period_text" placeholder="Ex: 08:00-10:00" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="form.collision_occurred" />
                  Colisão ocorrida?
                </label>
              </div>
              <div class="form-group" v-if="form.collision_occurred">
                <label>Espécie envolvida na colisão</label>
                <input type="text" v-model="form.collision_species" placeholder="Nome da espécie" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Condições climáticas</label>
                <select v-model="form.weather_id">
                  <option value="">Selecione...</option>
                  <option v-for="w in lookups.condicoes_clima" :key="w.id" :value="w.id">
                    {{ w.name }}
                  </option>
                </select>
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="form.mandatory_report" />
                  Reporte mandatório?
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nome do Inspetor</label>
                <input type="text" v-model="form.inspector_name" placeholder="Nome completo" />
              </div>
              <div class="form-group">
                <label>Equipe</label>
                <input type="text" v-model="form.inspector_team" placeholder="Ex: Equipe A" />
              </div>
            </div>

            <div class="form-group">
              <label>Notas Gerais</label>
              <textarea v-model="form.notes" rows="3" placeholder="Observações adicionais..."></textarea>
            </div>
          </section>

          <!-- Seção 2: Área de Movimentação de Aeronaves -->
          <section class="form-section">
            <h4>2. Área de Movimentação de Aeronaves</h4>
            <p class="help-text">Registre espécie, quantidade e quadrante para cada local listado</p>

            <button type="button" @click="adicionarObservacaoAerodromo" class="btn btn-sm">+ Adicionar Observação</button>

            <div v-for="(obs, idx) in form.aerodrome_observations" :key="idx" class="nested-item">
              <div class="form-row">
                <div class="form-group">
                  <label>Local *</label>
                  <select v-model="obs.location_type_id" required>
                    <option value="">Selecione...</option>
                    <option v-for="loc in locaisAerodromo" :key="loc.id" :value="loc.id">
                      {{ loc.name }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Espécie</label>
                  <select v-model="obs.species_id">
                    <option value="">Selecione...</option>
                    <option v-for="sp in especies" :key="sp.species_id" :value="sp.species_id">
                      {{ sp.common_name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Espécie (texto livre)</label>
                  <input type="text" v-model="obs.species_text" placeholder="Se não encontrou na lista" />
                </div>
                <div class="form-group">
                  <label>Quantidade</label>
                  <input type="number" v-model.number="obs.quantity" min="0" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Quadrante</label>
                  <select v-model="obs.quadrant_id">
                    <option value="">Selecione...</option>
                    <option v-for="q in lookups.quadrantes" :key="q.id" :value="q.id">
                      {{ q.code }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Quadrante (texto)</label>
                  <input type="text" v-model="obs.quadrant_text" />
                </div>
              </div>

              <div class="form-group">
                <label>Notas</label>
                <textarea v-model="obs.notes" rows="2"></textarea>
              </div>

              <button type="button" @click="removerObservacaoAerodromo(idx)" class="btn-danger-sm">Remover</button>
            </div>

            <div class="subsection">
              <h5>Ninhos na Área de Movimentação</h5>
              <button type="button" @click="adicionarNinho('aerodrome')" class="btn btn-sm">+ Adicionar Ninho</button>

              <div v-for="(ninho, idx) in ninhosAerodromo" :key="idx" class="nested-item">
                <div class="form-row">
                  <div class="form-group">
                    <label>Local do ninho *</label>
                    <input type="text" v-model="ninho.location_text" required />
                  </div>
                  <div class="form-group">
                    <label>Quadrante</label>
                    <select v-model="ninho.quadrant_id">
                      <option value="">Selecione...</option>
                      <option v-for="q in lookups.quadrantes" :key="q.id" :value="q.id">
                        {{ q.code }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" v-model="ninho.has_eggs" />
                      Presença de ovos?
                    </label>
                  </div>
                  <div class="form-group" v-if="ninho.has_eggs">
                    <label>Quantidade de ovos</label>
                    <input type="number" v-model.number="ninho.egg_count" min="0" />
                  </div>
                </div>

                <button type="button" @click="removerNinho(idx, 'aerodrome')" class="btn-danger-sm">Remover</button>
              </div>
            </div>
          </section>

          <!-- Seção 3: Demais Áreas do Sítio Aeroportuário -->
          <section class="form-section">
            <h4>3. Demais Áreas do Sítio Aeroportuário</h4>

            <button type="button" @click="adicionarObservacaoSitio" class="btn btn-sm">+ Adicionar Observação</button>

            <div v-for="(obs, idx) in form.site_observations" :key="idx" class="nested-item">
              <div class="form-row">
                <div class="form-group">
                  <label>Local *</label>
                  <select v-model="obs.location_type_id" required>
                    <option value="">Selecione...</option>
                    <option v-for="loc in locaisSitio" :key="loc.id" :value="loc.id">
                      {{ loc.name }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Espécie</label>
                  <select v-model="obs.species_id">
                    <option value="">Selecione...</option>
                    <option v-for="sp in especies" :key="sp.species_id" :value="sp.species_id">
                      {{ sp.common_name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Espécie (texto livre)</label>
                  <input type="text" v-model="obs.species_text" />
                </div>
                <div class="form-group">
                  <label>Quantidade</label>
                  <input type="number" v-model.number="obs.quantity" min="0" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Quadrante</label>
                  <select v-model="obs.quadrant_id">
                    <option value="">Selecione...</option>
                    <option v-for="q in lookups.quadrantes" :key="q.id" :value="q.id">
                      {{ q.code }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Quadrante (texto)</label>
                  <input type="text" v-model="obs.quadrant_text" />
                </div>
              </div>

              <button type="button" @click="removerObservacaoSitio(idx)" class="btn-danger-sm">Remover</button>
            </div>

            <div class="subsection">
              <h5>Ninhos em Demais Áreas</h5>
              <button type="button" @click="adicionarNinho('site')" class="btn btn-sm">+ Adicionar Ninho</button>

              <div v-for="(ninho, idx) in ninhosSitio" :key="idx" class="nested-item">
                <div class="form-row">
                  <div class="form-group">
                    <label>Local do ninho *</label>
                    <input type="text" v-model="ninho.location_text" required />
                  </div>
                  <div class="form-group checkbox-group">
                    <label>
                      <input type="checkbox" v-model="ninho.has_eggs" />
                      Presença de ovos?
                    </label>
                  </div>
                </div>

                <button type="button" @click="removerNinho(idx, 'site')" class="btn-danger-sm">Remover</button>
              </div>
            </div>
          </section>

          <!-- Seção 4: Carcaças Encontradas -->
          <section class="form-section">
            <h4>4. Carcaças Encontradas (exceto a 60m da faixa de pista)</h4>

            <button type="button" @click="adicionarCarcaca" class="btn btn-sm">+ Adicionar Carcaça</button>

            <div v-for="(carcaca, idx) in form.carcasses" :key="idx" class="nested-item">
              <div class="form-row">
                <div class="form-group">
                  <label>Local *</label>
                  <input type="text" v-model="carcaca.location_text" required />
                </div>
                <div class="form-group">
                  <label>Quadrante</label>
                  <select v-model="carcaca.quadrant_id">
                    <option value="">Selecione...</option>
                    <option v-for="q in lookups.quadrantes" :key="q.id" :value="q.id">
                      {{ q.code }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="carcaca.photographed" />
                    Fotografada?
                  </label>
                </div>
                <div class="form-group">
                  <label>Espécie identificada</label>
                  <select v-model="carcaca.species_id">
                    <option value="">Selecione...</option>
                    <option v-for="sp in especies" :key="sp.species_id" :value="sp.species_id">
                      {{ sp.common_name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Espécie (texto livre)</label>
                  <input type="text" v-model="carcaca.species_text" />
                </div>
                <div class="form-group">
                  <label>Destinação</label>
                  <select v-model="carcaca.destination_id">
                    <option value="">Selecione...</option>
                    <option v-for="d in lookups.destinos_carcaca" :key="d.id" :value="d.id">
                      {{ d.name }}
                    </option>
                  </select>
                </div>
              </div>

              <button type="button" @click="removerCarcaca(idx)" class="btn-danger-sm">Remover</button>
            </div>
          </section>

          <!-- Seção 5: Manejo Animal -->
          <section class="form-section">
            <h4>5. Manejo Animal - Ações Realizadas</h4>

            <div class="form-row">
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="form.management.dispersal_performed" />
                  Afugentamento realizado?
                </label>
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="form.management.capture_performed" />
                  Captura realizada?
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Técnicas Utilizadas (seleção múltipla)</label>
              <div class="checkbox-list">
                <label v-for="tec in lookups.tecnicas_manejo" :key="tec.id">
                  <input
                    type="checkbox"
                    :value="tec.id"
                    v-model="form.management.techniques"
                  />
                  {{ tec.name }}
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>Espécie(s) Envolvidas</label>
              <textarea v-model="form.management.species_involved" rows="2"
                placeholder="Liste as espécies envolvidas nas ações de manejo"></textarea>
            </div>

            <div class="form-group">
              <label>Destinação da Espécie Capturada</label>
              <textarea v-model="form.management.capture_destination" rows="2"
                placeholder="Soltura, transferência, encaminhamento, etc."></textarea>
            </div>

            <div class="form-group">
              <label>Notas sobre Manejo</label>
              <textarea v-model="form.management.notes" rows="3"></textarea>
            </div>
          </section>

          <!-- Botões de Ação -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">{{ modoEdicao ? 'Atualizar' : 'Salvar' }}</button>
            <button type="button" @click="cancelarEdicao" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import ApiService from '../services/api';

// Estado
const inspecoes = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const especies = ref<any[]>([]);
const lookups = ref<any>({
  periodos_inspecao: [],
  condicoes_clima: [],
  destinos_carcaca: [],
  tecnicas_manejo: [],
  tipos_local_inspecao: [],
  quadrantes: []
});

const inspecaoSelecionada = ref<any>(null);
const modoEdicao = ref(false);

const filtros = reactive({
  inicio: '',
  fim: ''
});

const formPadrao = () => ({
  airport_id: '',
  inspection_date: new Date().toISOString().split('T')[0],
  inspection_time: new Date().toTimeString().slice(0, 5),
  period_id: '',
  period_text: '',
  collision_occurred: false,
  collision_species: '',
  weather_id: '',
  mandatory_report: false,
  inspector_name: '',
  inspector_team: '',
  notes: '',
  aerodrome_observations: [],
  site_observations: [],
  nests: [],
  carcasses: [],
  management: {
    dispersal_performed: false,
    capture_performed: false,
    species_involved: '',
    capture_destination: '',
    notes: '',
    techniques: []
  }
});

const form = reactive(formPadrao());

// Computed
const locaisAerodromo = computed(() =>
  lookups.value.tipos_local_inspecao?.filter((l: any) => l.category === 'aerodrome') || []
);

const locaisSitio = computed(() =>
  lookups.value.tipos_local_inspecao?.filter((l: any) => l.category === 'site') || []
);

const ninhosAerodromo = computed(() =>
  form.nests.filter((n: any) => n.area_type === 'aerodrome')
);

const ninhosSitio = computed(() =>
  form.nests.filter((n: any) => n.area_type === 'site')
);

// Métodos
async function carregarDados() {
  try {
    const [aero, esp, look] = await Promise.all([
      ApiService.getAeroportos(),
      ApiService.getEspecies(),
      ApiService.getLookups()
    ]);
    aeroportos.value = aero;
    especies.value = esp;
    lookups.value = look;
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    alert('Erro ao carregar dados iniciais');
  }
}

async function carregarInspecoes() {
  try {
    const params: any = {};
    if (filtros.inicio) params.inicio = filtros.inicio;
    if (filtros.fim) params.fim = filtros.fim;

    const response = await ApiService.getInspecoesDiarias(params);
    inspecoes.value = response.data || response;
  } catch (error) {
    console.error('Erro ao carregar inspeções:', error);
    alert('Erro ao carregar inspeções');
  }
}

function novaInspecao() {
  Object.assign(form, formPadrao());
  inspecaoSelecionada.value = null;
  modoEdicao.value = false;
}

function editarInspecao(inspecao: any) {
  inspecaoSelecionada.value = inspecao;
  modoEdicao.value = true;

  Object.assign(form, {
    airport_id: inspecao.airport_id,
    inspection_date: inspecao.inspection_date,
    inspection_time: inspecao.inspection_time,
    period_id: inspecao.period_id || '',
    period_text: inspecao.period_text || '',
    collision_occurred: inspecao.collision_occurred || false,
    collision_species: inspecao.collision_species || '',
    weather_id: inspecao.weather_id || '',
    mandatory_report: inspecao.mandatory_report || false,
    inspector_name: inspecao.inspector_name || '',
    inspector_team: inspecao.inspector_team || '',
    notes: inspecao.notes || '',
    aerodrome_observations: inspecao.aerodrome_observations || [],
    site_observations: inspecao.site_observations || [],
    nests: inspecao.nests || [],
    carcasses: inspecao.carcasses || [],
    management: {
      dispersal_performed: inspecao.management?.dispersal_performed || false,
      capture_performed: inspecao.management?.capture_performed || false,
      species_involved: inspecao.management?.species_involved || '',
      capture_destination: inspecao.management?.capture_destination || '',
      notes: inspecao.management?.notes || '',
      techniques: inspecao.management?.techniques?.map((t: any) => t.technique_id) || []
    }
  });
}

async function salvarInspecao() {
  try {
    const payload = { ...form };

    if (modoEdicao.value && inspecaoSelecionada.value) {
      await ApiService.atualizarInspecaoDiaria(inspecaoSelecionada.value.inspection_id, payload);
      alert('Inspeção atualizada com sucesso!');
    } else {
      await ApiService.criarInspecaoDiaria(payload);
      alert('Inspeção criada com sucesso!');
    }

    await carregarInspecoes();
    novaInspecao();
  } catch (error: any) {
    console.error('Erro ao salvar inspeção:', error);
    alert('Erro ao salvar inspeção: ' + (error.response?.data?.message || error.message));
  }
}

async function removerInspecao(id: number) {
  if (!confirm('Deseja realmente remover esta inspeção?')) return;

  try {
    await ApiService.removerInspecaoDiaria(id);
    alert('Inspeção removida com sucesso!');
    await carregarInspecoes();
    if (inspecaoSelecionada.value?.inspection_id === id) {
      novaInspecao();
    }
  } catch (error) {
    console.error('Erro ao remover inspeção:', error);
    alert('Erro ao remover inspeção');
  }
}

function cancelarEdicao() {
  novaInspecao();
}

// Métodos auxiliares para adicionar/remover itens
function adicionarObservacaoAerodromo() {
  form.aerodrome_observations.push({
    location_type_id: '',
    species_id: '',
    species_text: '',
    quantity: null,
    quadrant_id: '',
    quadrant_text: '',
    notes: ''
  });
}

function removerObservacaoAerodromo(idx: number) {
  form.aerodrome_observations.splice(idx, 1);
}

function adicionarObservacaoSitio() {
  form.site_observations.push({
    location_type_id: '',
    species_id: '',
    species_text: '',
    quantity: null,
    quadrant_id: '',
    quadrant_text: '',
    notes: ''
  });
}

function removerObservacaoSitio(idx: number) {
  form.site_observations.splice(idx, 1);
}

function adicionarNinho(areaType: 'aerodrome' | 'site') {
  form.nests.push({
    area_type: areaType,
    location_text: '',
    quadrant_id: '',
    quadrant_text: '',
    has_eggs: false,
    egg_count: null,
    notes: ''
  });
}

function removerNinho(idx: number, areaType: 'aerodrome' | 'site') {
  const globalIdx = form.nests.findIndex((n: any, i: number) =>
    n.area_type === areaType && form.nests.filter((x: any) => x.area_type === areaType).indexOf(n) === idx
  );
  if (globalIdx !== -1) form.nests.splice(globalIdx, 1);
}

function adicionarCarcaca() {
  form.carcasses.push({
    location_text: '',
    quadrant_id: '',
    quadrant_text: '',
    photographed: false,
    species_id: '',
    species_text: '',
    destination_id: '',
    notes: ''
  });
}

function removerCarcaca(idx: number) {
  form.carcasses.splice(idx, 1);
}

function formatarData(data: string) {
  if (!data) return '';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

async function exportarPDF() {
  try {
    const params: any = {};
    if (filtros.inicio) params.inicio = filtros.inicio;
    if (filtros.fim) params.fim = filtros.fim;

    const response = await ApiService.exportarInspecoesDiarias(params);

    // Criar um link temporário para download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const filename = `inspecoes-diarias-${filtros.inicio || 'inicio'}-${filtros.fim || 'fim'}.pdf`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Erro ao exportar PDF:', error);
    if (error.response?.status === 404) {
      alert('Nenhuma inspeção encontrada para o período informado');
    } else {
      alert('Erro ao exportar PDF: ' + (error.message || 'Erro desconhecido'));
    }
  }
}

// Lifecycle
onMounted(async () => {
  await carregarDados();
  await carregarInspecoes();
});
</script>

<style scoped>
.inspecoes-diarias-container {
  padding: 20px;
  max-width: 1800px;
  margin: 0 auto;
}

.page-title {
  font-size: 28px;
  margin-bottom: 10px;
  color: #2c3e50;
}

.subtitle {
  color: #7f8c8d;
  margin-bottom: 20px;
}

.two-column-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 20px;
  min-height: 600px;
}

.left-column {
  border-right: 1px solid #ddd;
  padding-right: 20px;
}

.right-column {
  overflow-y: auto;
  max-height: calc(100vh - 150px);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.toolbar h2 {
  font-size: 18px;
  margin: 0;
}

.filters {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.filter-group {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.filter-group label {
  font-weight: bold;
}

.inspection-list {
  max-height: calc(100vh - 350px);
  overflow-y: auto;
}

.inspection-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.inspection-card:hover {
  background: #f8f9fa;
  border-color: #3498db;
}

.inspection-card.active {
  background: #e3f2fd;
  border-color: #2196f3;
}

.inspection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge {
  background: #3498db;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.alert-collision {
  color: #e74c3c;
  font-weight: bold;
  margin: 4px 0;
}

.alert-report {
  color: #f39c12;
  font-weight: bold;
  margin: 4px 0;
}

.inspection-actions {
  margin-top: 8px;
}

.inspection-form {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.form-section {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.form-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 8px;
}

.form-section h5 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #34495e;
}

.subsection {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed #bdc3c7;
}

.help-text {
  color: #7f8c8d;
  font-size: 14px;
  margin-bottom: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 5px;
  color: #34495e;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
}

.checkbox-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.checkbox-list label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nested-item {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-danger-sm {
  padding: 4px 8px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  margin-top: 10px;
}

.btn-danger-sm:hover {
  background: #c0392b;
}

@media (max-width: 1200px) {
  .two-column-layout {
    grid-template-columns: 1fr;
  }

  .left-column {
    border-right: none;
    border-bottom: 1px solid #ddd;
    padding-bottom: 20px;
    margin-bottom: 20px;
  }
}
</style>
