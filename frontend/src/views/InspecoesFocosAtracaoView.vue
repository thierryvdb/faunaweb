<template>
  <div class="inspecoes-focos-atracao-container">
    <h1 class="page-title">F3 – Monitoramento de Focos de Atração de Fauna</h1>
    <p class="subtitle">Vistoria trimestral de pontos que possam atrair fauna silvestre no sítio aeroportuário.</p>

    <div class="two-column-layout">
      <!-- Coluna da Esquerda: Lista de Inspeções -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Registros de Monitoramento</h2>
          <button @click="novaInspecao" class="btn btn-primary">+ Novo Registro</button>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label>Período:</label>
            <input type="date" v-model="filtros.inicio" />
            <span>até</span>
            <input type="date" v-model="filtros.fim" />
          </div>
          <button @click="carregarInspecoes" class="btn btn-secondary">Filtrar</button>
          <button @click="exportar('pdf')" class="btn btn-secondary">📄 PDF</button>
          <button @click="exportar('docx')" class="btn btn-secondary">📝 DOCX</button>
        </div>

        <div class="inspecoes-list">
          <div
            v-for="insp in inspecoes"
            :key="insp.focus_inspection_id"
            :class="['inspecao-card', { active: inspecaoSelecionada?.focus_inspection_id === insp.focus_inspection_id }]"
            @click="selecionarInspecao(insp)"
          >
            <div class="inspecao-header">
              <strong>{{ formatarData(insp.inspection_date) }}</strong>
              <span class="badge badge-airport">{{ insp.icao_code }}</span>
            </div>
            <div class="inspecao-details">
              <p class="season-info">{{ insp.season_name }}</p>
              <p v-if="insp.rained_last_24h" class="rain-info">☔ Choveu nas últimas 24h</p>
            </div>
            <div class="inspecao-actions">
              <button @click.stop="removerInspecao(insp.focus_inspection_id)" class="btn-danger-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Coluna da Direita: Formulário -->
      <div class="right-column">
        <form @submit.prevent="salvarInspecao" class="inspecao-form">
          <h3>{{ modoEdicao ? 'Editando Registro' : 'Nova Inspeção' }}</h3>

          <section class="form-section">
            <h4>1. Informações Gerais</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Data *</label>
                <input type="date" v-model="form.inspection_date" required />
              </div>
              <div class="form-group">
                <label>Período do Ano *</label>
                <select v-model="form.season_id" required>
                  <option value="">Selecione...</option>
                  <option v-for="s in lookups.estacoes_ano" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" v-model="form.rained_last_24h" /> Houve chuva nas últimas 24h?</label>
            </div>
          </section>

          <!-- 2. Focos Secundários -->
          <section class="form-section">
            <h4>2. Focos Secundários</h4>
            <p class="section-hint">Cupinzeiros, ninhos, ovos, formigueiros, etc.</p>
            <div v-for="(foco, idx) in form.secondary_focuses" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Foco Secundário #{{ idx + 1 }}</strong>
                <button type="button" @click="removerFocoSecundario(idx)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Tipo *</label>
                  <select v-model="foco.type" required>
                    <option value="cupinzeiro">Cupinzeiro</option>
                    <option value="pequenos_animais">Pequenos Animais</option>
                    <option value="ninhos">Ninhos</option>
                    <option value="ovos">Ovos</option>
                    <option value="formigueiros">Formigueiros</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div class="form-group" v-if="foco.type === 'outros'">
                  <label>Especificar</label>
                  <input type="text" v-model="foco.other_type" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="foco.removal_performed" /> Desinsetização/Remoção realizada?</label>
                </div>
                <div class="form-group" v-if="foco.removal_performed">
                  <label>Data da Ação</label>
                  <input type="date" v-model="foco.action_date" />
                </div>
              </div>
              <div class="form-group">
                <label>Localização</label>
                <input type="text" v-model="foco.location" />
              </div>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="foco.individuals_present" /> Presença/aglomeração de indivíduos?</label>
                </div>
                <div class="form-group">
                  <label>Espécies Presentes</label>
                  <input type="text" v-model="foco.species_present" />
                </div>
              </div>
            </div>
            <button type="button" @click="adicionarFocoSecundario" class="btn btn-secondary">+ Adicionar Foco Secundário</button>
          </section>

          <!-- 3. Áreas Verdes -->
          <section class="form-section">
            <h4>3. Áreas Verdes</h4>
            <p class="section-hint">Gramados, árvores, arbustos, vegetação rasteira, etc.</p>
            <div v-for="(foco, idx) in form.green_area_focuses" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Foco em Área Verde #{{ idx + 1 }}</strong>
                <button type="button" @click="removerFocoAreaVerde(idx)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Tipo *</label>
                  <select v-model="foco.type" required>
                    <option value="gramado">Gramado</option>
                    <option value="areas_verdes">Áreas Verdes</option>
                    <option value="arvore">Árvore</option>
                    <option value="arbustos">Arbustos</option>
                    <option value="trepadeiras">Trepadeiras</option>
                    <option value="vegetacao_rasteira">Vegetação Rasteira</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div class="form-group" v-if="foco.type === 'outros'">
                  <label>Especificar</label>
                  <input type="text" v-model="foco.other_type" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Data</label>
                  <input type="date" v-model="foco.action_date" />
                </div>
                <div class="form-group">
                  <label>Ação Realizada</label>
                  <select v-model="foco.action_performed">
                    <option value="">Nenhuma</option>
                    <option value="ceifagem">Ceifagem</option>
                    <option value="poda">Poda</option>
                    <option value="extracao">Extração</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Localização</label>
                <input type="text" v-model="foco.location" />
              </div>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="foco.animal_presence" /> Presença/aglomeração de animais?</label>
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="foco.nests_eggs_present" /> Presença de ninhos/ovos?</label>
                </div>
              </div>
              <div class="form-group">
                <label>Espécies Presentes</label>
                <input type="text" v-model="foco.species_present" />
              </div>
            </div>
            <button type="button" @click="adicionarFocoAreaVerde" class="btn btn-secondary">+ Adicionar Foco Área Verde</button>
          </section>

          <!-- 4. Sistema de Drenagem -->
          <section class="form-section">
            <h4>4. Sistema de Drenagem</h4>

            <!-- 4.1 Caixa de Drenagem -->
            <div class="subsection-header-inline">
              <h5>4.1 Caixa de Drenagem</h5>
              <button type="button" @click="adicionarCaixaDrenagem" class="btn btn-secondary-sm">+ Adicionar</button>
            </div>
            <div v-for="(box, idx) in form.drainage_system_focuses.drainage_boxes" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Caixa #{{ idx + 1 }}</strong>
                <button type="button" @click="form.drainage_system_focuses.drainage_boxes.splice(idx, 1)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="checkbox-grid">
                <label><input type="checkbox" v-model="box.missing_grid" /> Ausência de grade/tela</label>
                <label><input type="checkbox" v-model="box.damaged_cover" /> Tampa danificada</label>
                <label><input type="checkbox" v-model="box.missing_cover" /> Ausência de tampa</label>
                <label><input type="checkbox" v-model="box.hole_around" /> Buraco ao redor</label>
                <label><input type="checkbox" v-model="box.repair_performed" /> Conserto/Manutenção realizado</label>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Localização</label>
                  <input type="text" v-model="box.location" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="box.animal_presence" /> Presença de animais?</label>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Espécies</label>
                  <input type="text" v-model="box.species_present" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="box.nests_eggs_present" /> Ninhos/Ovos?</label>
                </div>
              </div>
            </div>

            <!-- 4.2 Boca de Lobo -->
            <div class="subsection-header-inline">
              <h5>4.2 Boca de Lobo</h5>
              <button type="button" @click="adicionarBocaLobo" class="btn btn-secondary-sm">+ Adicionar</button>
            </div>
            <div v-for="(manhole, idx) in form.drainage_system_focuses.manholes" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Boca de Lobo #{{ idx + 1 }}</strong>
                <button type="button" @click="form.drainage_system_focuses.manholes.splice(idx, 1)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="checkbox-grid">
                <label><input type="checkbox" v-model="manhole.missing_grid" /> Ausência de grade/tela</label>
                <label><input type="checkbox" v-model="manhole.damaged_cover" /> Tampa danificada</label>
                <label><input type="checkbox" v-model="manhole.missing_cover" /> Ausência de tampa</label>
                <label><input type="checkbox" v-model="manhole.hole_around" /> Buraco ao redor</label>
                <label><input type="checkbox" v-model="manhole.repair_performed" /> Conserto/Manutenção realizado</label>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Data do Reparo</label>
                  <input type="date" v-model="manhole.repair_date" />
                </div>
                <div class="form-group">
                  <label>Localização</label>
                  <input type="text" v-model="manhole.location" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="manhole.animal_presence" /> Presença de animais?</label>
                </div>
                <div class="form-group">
                  <label>Espécies</label>
                  <input type="text" v-model="manhole.species_present" />
                </div>
              </div>
              <div class="form-group checkbox-group">
                <label><input type="checkbox" v-model="manhole.nests_eggs_present" /> Presença de ninhos/ovos?</label>
              </div>
            </div>

            <!-- 4.3 Vala de Drenagem -->
            <div class="subsection-header-inline">
              <h5>4.3 Vala de Drenagem</h5>
              <button type="button" @click="adicionarValaDrenagem" class="btn btn-secondary-sm">+ Adicionar</button>
            </div>
            <div v-for="(ditch, idx) in form.drainage_system_focuses.drainage_ditches" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Vala #{{ idx + 1 }}</strong>
                <button type="button" @click="form.drainage_system_focuses.drainage_ditches.splice(idx, 1)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="form-group">
                <label>Condição</label>
                <select v-model="ditch.condition_type">
                  <option value="">Selecione...</option>
                  <option value="concreto">Concreto</option>
                  <option value="grama">Grama</option>
                </select>
              </div>
              <div class="checkbox-grid">
                <label><input type="checkbox" v-model="ditch.obstruction_vegetation" /> Obstrução por vegetação</label>
                <label><input type="checkbox" v-model="ditch.obstruction_debris" /> Obstrução por entulho</label>
                <label><input type="checkbox" v-model="ditch.obstruction_mud" /> Obstrução por lama</label>
                <label><input type="checkbox" v-model="ditch.clearance_performed" /> Desobstrução realizada</label>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Localização</label>
                  <input type="text" v-model="ditch.location" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="ditch.animal_presence" /> Presença de animais?</label>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Espécies</label>
                  <input type="text" v-model="ditch.species_present" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="ditch.nests_eggs_present" /> Ninhos/Ovos?</label>
                </div>
              </div>
            </div>

            <!-- 4.4 Bacia de Acumulação -->
            <div class="subsection-header-inline">
              <h5>4.4 Bacia de Acumulação</h5>
              <button type="button" @click="adicionarBaciaAcumulacao" class="btn btn-secondary-sm">+ Adicionar</button>
            </div>
            <div v-for="(basin, idx) in form.drainage_system_focuses.accumulation_basins" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Bacia #{{ idx + 1 }}</strong>
                <button type="button" @click="form.drainage_system_focuses.accumulation_basins.splice(idx, 1)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="checkbox-grid">
                <label><input type="checkbox" v-model="basin.water_accumulation" /> Acúmulo de água</label>
                <label><input type="checkbox" v-model="basin.vegetation_accumulation" /> Acúmulo de vegetação</label>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Localização</label>
                  <input type="text" v-model="basin.location" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="basin.animal_presence" /> Presença de animais?</label>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Espécies</label>
                  <input type="text" v-model="basin.species_present" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="basin.nests_eggs_present" /> Ninhos/Ovos?</label>
                </div>
              </div>
            </div>

            <!-- 4.5 Demais Acúmulos de Água -->
            <div class="subsection-header-inline">
              <h5>4.5 Demais Acúmulos de Água (Área Operacional)</h5>
              <button type="button" @click="adicionarOutroAcumulo" class="btn btn-secondary-sm">+ Adicionar</button>
            </div>
            <div v-for="(other, idx) in form.drainage_system_focuses.other_water_accumulations" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Acúmulo #{{ idx + 1 }}</strong>
                <button type="button" @click="form.drainage_system_focuses.other_water_accumulations.splice(idx, 1)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Localização</label>
                  <input type="text" v-model="other.location" />
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="other.animal_presence" /> Presença de animais?</label>
                </div>
              </div>
              <div class="form-group">
                <label>Espécies</label>
                <input type="text" v-model="other.species_present" />
              </div>
            </div>
          </section>

          <!-- 5. Descarte Irregular de Resíduos -->
          <section class="form-section">
            <h4>5. Descarte Irregular de Resíduos Sólidos</h4>
            <p class="section-hint">Registro de resíduos que possam atrair fauna</p>
            <div v-for="(waste, idx) in form.waste_disposal_focuses" :key="idx" class="subsection-item">
              <div class="subsection-header">
                <strong>Descarte #{{ idx + 1 }}</strong>
                <button type="button" @click="removerFocoResiduo(idx)" class="btn-danger-sm">Remover</button>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Tipologia *</label>
                  <select v-model="waste.waste_type" required>
                    <option value="organico">Orgânico</option>
                    <option value="inorganico">Inorgânico</option>
                    <option value="construcao_civil">Construção Civil</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Localização</label>
                  <input type="text" v-model="waste.location" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="waste.removal_performed" /> Remoção realizada?</label>
                </div>
                <div class="form-group checkbox-group">
                  <label><input type="checkbox" v-model="waste.animal_presence" /> Presença/aglomeração de animais?</label>
                </div>
              </div>
              <div class="form-group">
                <label>Espécies Observadas</label>
                <input type="text" v-model="waste.observed_species" />
              </div>
            </div>
            <button type="button" @click="adicionarFocoResiduo" class="btn btn-secondary">+ Adicionar Foco de Resíduos</button>
          </section>

          <!-- 6. Observações Gerais -->
          <section class="form-section">
            <h4>6. Observações Gerais</h4>
            <textarea v-model="form.general_observations" rows="4" placeholder="Campo livre para informações adicionais"></textarea>
          </section>

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
import { ref, reactive, onMounted } from 'vue';
import { ApiService } from '../services/api';

const inspecoes = ref<any[]>([]);
const lookups = ref<any>({});
const inspecaoSelecionada = ref<any>(null);
const modoEdicao = ref(false);

const filtros = reactive({
  inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  fim: new Date().toISOString().split('T')[0],
});

const formPadrao = () => ({
  airport_id: ApiService.getUser<any>()?.aeroporto_id || '',
  inspection_date: new Date().toISOString().split('T')[0],
  season_id: '',
  rained_last_24h: false,
  secondary_focuses: [] as any[],
  green_area_focuses: [] as any[],
  drainage_system_focuses: {
    drainage_boxes: [] as any[],
    manholes: [] as any[],
    drainage_ditches: [] as any[],
    accumulation_basins: [] as any[],
    other_water_accumulations: [] as any[],
  },
  waste_disposal_focuses: [] as any[],
  general_observations: '',
});

const form = reactive(formPadrao());

onMounted(async () => {
  await carregarLookups();
  await carregarInspecoes();
});

async function carregarLookups() {
  const data = await ApiService.getLookups();
  lookups.value = data;
}

async function carregarInspecoes() {
  const params = { airportId: form.airport_id, inicio: filtros.inicio, fim: filtros.fim };
  const data = await ApiService.getInspecoesFocosAtracao(params);
  inspecoes.value = data;
}

function novaInspecao() {
  Object.assign(form, formPadrao());
  inspecaoSelecionada.value = null;
  modoEdicao.value = false;
}

function selecionarInspecao(insp: any) {
  inspecaoSelecionada.value = insp;
  Object.assign(form, {
    ...insp,
    secondary_focuses: Array.isArray(insp.secondary_focuses) ? insp.secondary_focuses : (insp.secondary_focuses ? JSON.parse(insp.secondary_focuses) : []),
    green_area_focuses: Array.isArray(insp.green_area_focuses) ? insp.green_area_focuses : (insp.green_area_focuses ? JSON.parse(insp.green_area_focuses) : []),
    drainage_system_focuses: typeof insp.drainage_system_focuses === 'object' ? insp.drainage_system_focuses : (insp.drainage_system_focuses ? JSON.parse(insp.drainage_system_focuses) : {
      drainage_boxes: [],
      manholes: [],
      drainage_ditches: [],
      accumulation_basins: [],
      other_water_accumulations: [],
    }),
    waste_disposal_focuses: Array.isArray(insp.waste_disposal_focuses) ? insp.waste_disposal_focuses : (insp.waste_disposal_focuses ? JSON.parse(insp.waste_disposal_focuses) : []),
  });
  modoEdicao.value = true;
}

async function salvarInspecao() {
  try {
    const payload = { ...form };
    if (modoEdicao.value && inspecaoSelecionada.value) {
      await ApiService.atualizarInspecaoFocoAtracao(inspecaoSelecionada.value.focus_inspection_id, payload);
      alert('Inspeção atualizada com sucesso!');
    } else {
      await ApiService.criarInspecaoFocoAtracao(payload);
      alert('Inspeção criada com sucesso!');
    }
    await carregarInspecoes();
    novaInspecao();
  } catch (error: any) {
    alert('Erro ao salvar: ' + (error.response?.data?.message || error.message));
  }
}

async function removerInspecao(id: number) {
  if (!confirm('Deseja realmente remover esta inspeção?')) return;
  try {
    await ApiService.removerInspecaoFocoAtracao(id);
    await carregarInspecoes();
    if (inspecaoSelecionada.value?.focus_inspection_id === id) {
      novaInspecao();
    }
  } catch (error: any) {
    alert('Erro ao remover: ' + (error.response?.data?.message || error.message));
  }
}

function cancelarEdicao() {
  novaInspecao();
}

// Focos Secundários
function adicionarFocoSecundario() {
  form.secondary_focuses.push({
    type: 'cupinzeiro',
    other_type: '',
    removal_performed: false,
    action_date: '',
    location: '',
    individuals_present: false,
    species_present: ''
  });
}

function removerFocoSecundario(idx: number) {
  form.secondary_focuses.splice(idx, 1);
}

// Áreas Verdes
function adicionarFocoAreaVerde() {
  form.green_area_focuses.push({
    type: 'gramado',
    other_type: '',
    action_date: '',
    action_performed: '',
    location: '',
    animal_presence: false,
    species_present: '',
    nests_eggs_present: false
  });
}

function removerFocoAreaVerde(idx: number) {
  form.green_area_focuses.splice(idx, 1);
}

// Sistema de Drenagem
function adicionarCaixaDrenagem() {
  form.drainage_system_focuses.drainage_boxes.push({
    missing_grid: false,
    damaged_cover: false,
    missing_cover: false,
    hole_around: false,
    repair_performed: false,
    location: '',
    animal_presence: false,
    species_present: '',
    nests_eggs_present: false,
  });
}

function adicionarBocaLobo() {
  form.drainage_system_focuses.manholes.push({
    missing_grid: false,
    damaged_cover: false,
    missing_cover: false,
    hole_around: false,
    repair_performed: false,
    repair_date: '',
    location: '',
    animal_presence: false,
    species_present: '',
    nests_eggs_present: false,
  });
}

function adicionarValaDrenagem() {
  form.drainage_system_focuses.drainage_ditches.push({
    condition_type: '',
    obstruction_vegetation: false,
    obstruction_debris: false,
    obstruction_mud: false,
    clearance_performed: false,
    location: '',
    animal_presence: false,
    species_present: '',
    nests_eggs_present: false,
  });
}

function adicionarBaciaAcumulacao() {
  form.drainage_system_focuses.accumulation_basins.push({
    water_accumulation: false,
    vegetation_accumulation: false,
    location: '',
    animal_presence: false,
    species_present: '',
    nests_eggs_present: false,
  });
}

function adicionarOutroAcumulo() {
  form.drainage_system_focuses.other_water_accumulations.push({
    location: '',
    animal_presence: false,
    species_present: '',
  });
}

// Resíduos
function adicionarFocoResiduo() {
  form.waste_disposal_focuses.push({
    waste_type: 'organico',
    location: '',
    removal_performed: false,
    observed_species: '',
    animal_presence: false
  });
}

function removerFocoResiduo(idx: number) {
  form.waste_disposal_focuses.splice(idx, 1);
}

async function exportar(formato: 'pdf' | 'docx') {
  try {
    const params = { airportId: form.airport_id, inicio: filtros.inicio, fim: filtros.fim, formato };
    const response = await ApiService.exportarInspecoesFocosAtracao(params);
    const blob = new Blob([response.data], {
      type: formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspecoes-focos-atracao-${filtros.inicio}-a-${filtros.fim}.${formato}`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    alert('Erro ao exportar: ' + (error.response?.data?.mensagem || error.message));
  }
}

function formatarData(data: string) {
  if (!data) return '';
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}
</script>

<style scoped>
.inspecoes-focos-atracao-container {
  padding: 20px;
}

.page-title {
  font-size: 28px;
  margin-bottom: 8px;
  color: #2c3e50;
}

.subtitle {
  color: #7f8c8d;
  margin-bottom: 24px;
}

.two-column-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  height: calc(100vh - 180px);
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar h2 {
  font-size: 18px;
  margin: 0;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.filter-group {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.filter-group label {
  font-size: 14px;
  font-weight: 500;
}

.filter-group input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.inspecoes-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inspecao-card {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.inspecao-card:hover {
  border-color: #3498db;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.inspecao-card.active {
  border-color: #3498db;
  background: #ebf5fb;
}

.inspecao-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge-airport {
  background: #3498db;
  color: white;
}

.inspecao-details {
  font-size: 14px;
  color: #555;
}

.season-info {
  margin: 4px 0;
  font-weight: 500;
}

.rain-info {
  margin: 4px 0;
  color: #3498db;
}

.inspecao-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.right-column {
  overflow-y: auto;
  padding-right: 8px;
}

.inspecao-form {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.inspecao-form h3 {
  margin-top: 0;
  margin-bottom: 24px;
  color: #2c3e50;
}

.form-section {
  margin-bottom: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid #e0e0e0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-section h4 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #34495e;
  font-size: 16px;
}

.form-section h5 {
  margin: 16px 0 12px 0;
  color: #5a6c7d;
  font-size: 14px;
}

.section-hint {
  margin: -8px 0 16px 0;
  font-size: 13px;
  color: #7f8c8d;
  font-style: italic;
}

.subsection-item {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
}

.subsection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ddd;
}

.subsection-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0 12px 0;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.checkbox-grid label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 14px;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
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
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
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

.btn-secondary-sm {
  padding: 6px 12px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary-sm:hover {
  background: #7f8c8d;
}

.btn-danger-sm {
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger-sm:hover {
  background: #c0392b;
}
</style>
