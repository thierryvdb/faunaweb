<template>
  <div class="inspecoes-areas-verdes-container">
    <h1 class="page-title">F2 – Manutenção de Áreas Verdes</h1>
    <p class="subtitle">Registro de atividades de manejo de vegetação no sítio aeroportuário.</p>

    <div class="two-column-layout">
      <!-- Coluna da Esquerda: Lista de Registros -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Registros de Manutenção</h2>
          <button @click="novoRegistro" class="btn btn-primary">+ Novo Registro</button>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label>Período:</label>
            <input type="date" v-model="filtros.inicio" />
            <span>até</span>
            <input type="date" v-model="filtros.fim" />
          </div>
          <button @click="carregarRegistros" class="btn btn-secondary">Filtrar</button>
          <button @click="exportar('pdf')" class="btn btn-secondary">📄 PDF</button>
          <button @click="exportar('docx')" class="btn btn-secondary">📝 DOCX</button>
        </div>

        <div class="registros-list">
          <div
            v-for="reg in registros"
            :key="reg.maintenance_id"
            :class="['registro-card', { active: registroSelecionado?.maintenance_id === reg.maintenance_id }]"
            @click="selecionarRegistro(reg)"
          >
            <div class="registro-header">
              <strong>{{ formatarData(reg.record_date) }}</strong>
              <span class="badge badge-type">{{ reg.record_type }}</span>
            </div>
            <div class="registro-details">
              <p class="airport-name">{{ reg.icao_code }}</p>
              <p class="obs-preview">
                <small>{{ reg.general_observations || 'Sem observações.' }}</small>
              </p>
            </div>
            <div class="registro-actions">
              <button @click.stop="removerRegistro(reg.maintenance_id)" class="btn-danger-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Coluna da Direita: Formulário -->
      <div class="right-column">
        <form @submit.prevent="salvarRegistro" class="registro-form">
          <h3>{{ modoEdicao ? 'Editar Registro' : 'Novo Registro de Manutenção' }}</h3>

          <section class="form-section">
            <h4>Informações Gerais</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Data *</label>
                <input type="date" v-model="form.record_date" required />
              </div>
              <div class="form-group">
                <label>Tipo de Registro *</label>
                <select v-model="form.record_type" required>
                  <option value="corte">Corte de Grama</option>
                  <option value="poda">Poda</option>
                  <option value="extracao">Extração</option>
                  <option value="limpeza">Limpeza</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Período do Ano *</label>
              <select v-model="form.season_id" required>
                <option v-for="s in lookups.seasons" :key="s.season_id" :value="s.season_id">{{ s.name }}</option>
              </select>
            </div>
          </section>

          <!-- Seção Corte de Grama -->
          <section v-if="form.record_type === 'corte'" class="form-section">
            <h4>Em caso de Corte de Grama</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Período da Atividade</label>
                <select v-model="form.grass_cutting.activity_period">
                  <option value="diurno">Diurno</option>
                  <option value="noturno">Noturno</option>
                </select>
              </div>
              <div class="form-group">
                <label>Equipamento Utilizado</label>
                <select v-model="form.grass_cutting.equipment">
                  <option value="manual">Manual</option>
                  <option value="rocadeira">Roçadeira</option>
                  <option value="trator">Trator</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group checkbox-group">
                <label><input type="checkbox" v-model="form.grass_cutting.cuttings_collected" /> Recolhimento de aparas?</label>
              </div>
              <div class="form-group">
                <label>Destino das Aparas</label>
                <input type="text" v-model="form.grass_cutting.cuttings_destination" />
              </div>
            </div>
            <div class="form-group">
              <label>Áreas Cortadas (Quadrantes)</label>
              <input type="text" v-model="form.grass_cutting.cut_areas" />
            </div>
            <div class="form-row">
              <div class="form-group checkbox-group">
                <label><input type="checkbox" v-model="form.grass_cutting.animal_attraction" /> Atração de animais?</label>
              </div>
              <div class="form-group">
                <label>Espécies Atraídas</label>
                <input type="text" v-model="form.grass_cutting.attracted_species" />
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" v-model="form.grass_cutting.gutter_cleaned" /> Limpeza de canaletas realizada?</label>
            </div>
          </section>

          <!-- Seção Poda ou Extração -->
          <section v-if="form.record_type === 'poda' || form.record_type === 'extracao'" class="form-section">
            <h4>Em caso de Poda ou Extração</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Tipo de Vegetação</label>
                <select v-model="form.pruning_extraction.vegetation_type">
                  <option value="arvores">Árvores</option>
                  <option value="arbustos">Arbustos</option>
                  <option value="trepadeiras">Trepadeiras</option>
                  <option value="rasteira">Vegetação Rasteira</option>
                </select>
              </div>
              <div class="form-group checkbox-group">
                <label><input type="checkbox" v-model="form.pruning_extraction.has_environmental_authorization" /> Possui autorização ambiental?</label>
              </div>
            </div>
            <div class="form-group">
              <label>Espécies Manejadas</label>
              <input type="text" v-model="form.pruning_extraction.managed_species" />
            </div>
            <div class="form-row">
              <div class="form-group checkbox-group">
                <label><input type="checkbox" v-model="form.pruning_extraction.cuttings_collected" /> Recolhimento de aparas?</label>
              </div>
              <div class="form-group">
                <label>Destino das Aparas</label>
                <input type="text" v-model="form.pruning_extraction.cuttings_destination" />
              </div>
            </div>
            <div class="form-group">
              <label>Localização da Vegetação (Área/Quadrante)</label>
              <input type="text" v-model="form.pruning_extraction.vegetation_location" />
            </div>
            <div class="form-row">
              <div class="form-group checkbox-group">
                <label><input type="checkbox" v-model="form.pruning_extraction.animal_attraction" /> Atração de animais?</label>
              </div>
              <div class="form-group">
                <label>Espécies Observadas</label>
                <input type="text" v-model="form.pruning_extraction.observed_species" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h4>Observações Gerais</h4>
            <textarea v-model="form.general_observations" rows="4"></textarea>
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
import { ref, reactive, onMounted, watch } from 'vue';
import { ApiService } from '../services/api';

const registros = ref<any[]>([]);
const lookups = ref<any>({ seasons: [] });
const registroSelecionado = ref<any>(null);
const modoEdicao = ref(false);

const filtros = reactive({
  inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  fim: new Date().toISOString().split('T')[0],
});

const formPadrao = () => ({
  airport_id: ApiService.getUser<any>()?.aeroporto_id || '',
  record_date: new Date().toISOString().split('T')[0],
  record_type: 'corte',
  season_id: '',
  general_observations: '',
  grass_cutting: {
    activity_period: 'diurno',
    equipment: 'rocadeira',
    cuttings_collected: false,
    cuttings_destination: '',
    cut_areas: '',
    animal_attraction: false,
    attracted_species: '',
    gutter_cleaned: false,
  },
  pruning_extraction: {
    vegetation_type: 'arvores',
    has_environmental_authorization: false,
    managed_species: '',
    cuttings_collected: false,
    cuttings_destination: '',
    vegetation_location: '',
    animal_attraction: false,
    observed_species: '',
  },
});

const form = reactive(formPadrao());

watch(() => form.record_type, (newType) => {
  if (modoEdicao.value) return;
  // Reset conditional fields when type changes
  if (newType === 'corte') {
    form.pruning_extraction = formPadrao().pruning_extraction;
  } else if (newType === 'poda' || newType === 'extracao') {
    form.grass_cutting = formPadrao().grass_cutting;
  } else {
    form.pruning_extraction = formPadrao().pruning_extraction;
    form.grass_cutting = formPadrao().grass_cutting;
  }
});

async function carregarDadosIniciais() {
  try {
    const data = await ApiService.getCadastros();
    lookups.value = data.lookups || { seasons: [] };
  } catch (error) {
    console.error('Erro ao carregar dados iniciais:', error);
  }
}

async function carregarRegistros() {
  try {
    const response = await ApiService.getInspecoesAreasVerdes(filtros);
    registros.value = response || [];
  } catch (error) {
    console.error('Erro ao carregar registros:', error);
    alert('Falha ao carregar registros.');
  }
}

function novoRegistro() {
  Object.assign(form, formPadrao());
  registroSelecionado.value = null;
  modoEdicao.value = false;
}

function selecionarRegistro(reg: any) {
  registroSelecionado.value = reg;
  modoEdicao.value = true;
  Object.assign(form, {
    ...formPadrao(), // Start with defaults to ensure all objects exist
    ...reg,
    record_date: reg.record_date.split('T')[0],
    grass_cutting: reg.grass_cutting || formPadrao().grass_cutting,
    pruning_extraction: reg.pruning_extraction || formPadrao().pruning_extraction,
  });
}

function cancelarEdicao() {
  novoRegistro();
}

async function salvarRegistro() {
  const payload: any = {
    airport_id: form.airport_id,
    record_date: form.record_date,
    record_type: form.record_type,
    season_id: form.season_id,
    general_observations: form.general_observations,
  };

  if (form.record_type === 'corte') {
    payload.grass_cutting = form.grass_cutting;
  } else if (form.record_type === 'poda' || form.record_type === 'extracao') {
    payload.pruning_extraction = form.pruning_extraction;
  }

  try {
    if (modoEdicao.value && registroSelecionado.value) {
      await ApiService.atualizarInspecaoAreaVerde(registroSelecionado.value.maintenance_id, payload);
      alert('Registro atualizado com sucesso!');
    } else {
      await ApiService.criarInspecaoAreaVerde(payload);
      alert('Registro salvo com sucesso!');
    }
    await carregarRegistros();
    novoRegistro();
  } catch (error: any) {
    console.error('Erro ao salvar registro:', error);
    alert('Erro ao salvar: ' + (error.response?.data?.message || error.message));
  }
}

async function removerRegistro(id: number) {
  if (!confirm('Deseja realmente remover este registro?')) return;

  try {
    await ApiService.removerInspecaoAreaVerde(id);
    alert('Registro removido com sucesso!');
    await carregarRegistros();
    if (registroSelecionado.value?.maintenance_id === id) {
      novoRegistro();
    }
  } catch (error) {
    console.error('Erro ao remover registro:', error);
    alert('Falha ao remover o registro.');
  }
}

function formatarData(data: string) {
  if (!data) return '';
  const d = new Date(data);
  const offset = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() + offset);
  return d.toLocaleDateString('pt-BR');
}

async function exportar(formato: 'pdf' | 'docx') {
  try {
    const params = { ...filtros, formato };
    const response = await ApiService.exportarInspecoesAreasVerdes(params);

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers['content-disposition'];
    let filename = `manutencao-areas-verdes.${formato}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch.length > 1) {
        filename = filenameMatch[1];
      }
    }
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error(`Erro ao exportar ${formato.toUpperCase()}:`, error);
    if (error.response?.status === 404) {
      alert('Nenhum registro encontrado para o período informado.');
    } else {
      alert(`Erro ao exportar ${formato.toUpperCase()}.`);
    }
  }
}

onMounted(async () => {
  await carregarDadosIniciais();
  await carregarRegistros();
});
</script>

<style scoped>
/* Estilos gerais e layout de duas colunas */
.inspecoes-areas-verdes-container { padding: 20px; max-width: 1800px; margin: 0 auto; }
.page-title { font-size: 28px; margin-bottom: 10px; color: #2c3e50; }
.subtitle { color: #7f8c8d; margin-bottom: 20px; }
.two-column-layout { display: grid; grid-template-columns: 400px 1fr; gap: 20px; min-height: 600px; }
.left-column { border-right: 1px solid #ddd; padding-right: 20px; }
.right-column { overflow-y: auto; max-height: calc(100vh - 150px); }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.toolbar h2 { font-size: 18px; margin: 0; }
.filters { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px; }
.filter-group { display: flex; gap: 10px; align-items: center; }
.registros-list { max-height: calc(100vh - 350px); overflow-y: auto; }

/* Estilos do Card */
.registro-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; }
.registro-card:hover { background: #f8f9fa; border-color: #27ae60; }
.registro-card.active { background: #e9f7ef; border-color: #2ecc71; }
.registro-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.badge-type { background-color: #27ae60; color: white; padding: 3px 7px; border-radius: 4px; font-size: 12px; text-transform: capitalize; }
.airport-name { font-weight: 600; color: #2c3e50; }
.obs-preview { color: #7f8c8d; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.registro-actions { margin-top: 8px; }

/* Estilos do Formulário */
.registro-form { background: white; padding: 20px; border-radius: 8px; }
.form-section { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.form-section h4 { margin-top: 0; margin-bottom: 15px; color: #2c3e50; border-bottom: 2px solid #2ecc71; padding-bottom: 8px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
.form-group { display: flex; flex-direction: column; margin-bottom: 10px; }
.form-group label { font-weight: 600; margin-bottom: 5px; color: #34495e; }
.form-group input, .form-group select, .form-group textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2ecc71; }
.checkbox-group { flex-direction: row; align-items: center; gap: 8px; }
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 2px solid #e0e0e0; }

/* Botões */
.btn { padding: 10px 20px; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: #2ecc71; color: white; }
.btn-primary:hover { background: #27ae60; }
.btn-secondary { background: #95a5a6; color: white; }
.btn-secondary:hover { background: #7f8c8d; }
.btn-danger-sm { padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
.btn-danger-sm:hover { background: #c0392b; }

@media (max-width: 1200px) {
  .two-column-layout { grid-template-columns: 1fr; }
  .left-column { border-right: none; border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
}
</style>