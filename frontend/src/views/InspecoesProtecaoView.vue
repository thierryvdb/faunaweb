<template>
  <div class="inspecoes-protecao-container">
    <FormTypeSelector
      :items="selectorTemplates"
      :modelValue="selectedTemplateId"
      @update:modelValue="handleTemplateChange"
    />
    <h1 class="page-title">Inspeções F4 - Sistema de Proteção</h1>
    <p class="subtitle">Periodicidade: 1 vez por semana ou sempre que houver necessidade | Abrangência: Todo o sítio aeroportuário</p>

    <div class="two-column-layout">
      <!-- Lista de Inspeções -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Inspeções Registradas</h2>
          <button @click="novaInspecao" class="btn btn-primary">+ Nova Inspeção F4</button>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label>Período:</label>
            <input type="date" v-model="filtros.inicio" />
            <span>até</span>
            <input type="date" v-model="filtros.fim" />
          </div>
          <button @click="carregarInspecoes" class="btn btn-secondary">Filtrar</button>
          <button @click="exportar('pdf')" class="btn btn-secondary">📄 Exportar PDF</button>
          <button @click="exportar('docx')" class="btn btn-secondary">📝 Exportar DOCX</button>
        </div>

        <div class="inspection-list">
          <div
            v-for="insp in inspecoes"
            :key="insp.inspection_id"
            :class="['inspection-card', { active: inspecaoSelecionada?.inspection_id === insp.inspection_id }]"
            @click="editarInspecao(insp)"
          >
            <div class="inspection-header">
              <strong>{{ formatarData(insp.inspection_date) }}</strong>
              <span class="badge">{{ insp.season_name || 'N/A' }}</span>
            </div>
            <div class="inspection-details">
              <p><small>{{ insp.airport_name }} ({{ insp.icao_code }})</small></p>
              <p v-if="insp.rained_last_24h" class="info-rain">🌧️ Chuva nas últimas 24h</p>
              <p><small>Cercas: {{ insp.fence_count || 0 }} | Portões: {{ insp.gate_count || 0 }}</small></p>
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
          <h3>{{ modoEdicao ? 'Editar Inspeção F4' : 'Nova Inspeção F4' }}</h3>

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
                <label>Data do Registro *</label>
                <input type="date" v-model="form.inspection_date" required />
              </div>
              <div class="form-group">
                <label>Período do Ano</label>
                <select v-model="form.season_id">
                  <option value="">Selecione...</option>
                  <option v-for="s in lookups.estacoes_ano" :key="s.id" :value="s.id">
                    {{ s.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="form.rained_last_24h" />
                  Houve chuva nas últimas 24 horas?
                </label>
              </div>
            </div>
          </section>

          <!-- Seção 2: Cercas Patrimoniais e Operacionais -->
          <section class="form-section">
            <h4>2. Cercas Patrimoniais e Operacionais</h4>
            <p class="help-text">Registre quando houver ocorrência</p>

            <button type="button" @click="adicionarOcorrenciaCerca" class="btn btn-sm">+ Adicionar Ocorrência em Cerca</button>

            <div v-for="(occ, idx) in form.fence_occurrences" :key="idx" class="nested-item">
              <h5>Ocorrência em Cerca #{{ idx + 1 }}</h5>

              <div class="form-group">
                <label>Localização do Registro *</label>
                <input type="text" v-model="occ.location_text" required />
              </div>

              <div class="form-group">
                <label>Tipos de Ocorrência (seleção múltipla)</label>
                <div class="checkbox-list">
                  <label v-for="tipo in lookups.tipos_ocorrencia_cerca" :key="tipo.id">
                    <input
                      type="checkbox"
                      :value="tipo.id"
                      v-model="occ.occurrence_types"
                    />
                    {{ tipo.name }}
                  </label>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="occ.repair_performed" />
                    Reparo realizado?
                  </label>
                </div>
                <div class="form-group" v-if="occ.repair_performed">
                  <label>Data do Reparo</label>
                  <input type="date" v-model="occ.repair_date" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="occ.irregular_waste_present" />
                    Presença de descarte irregular de resíduos?
                  </label>
                </div>
                <div class="form-group checkbox-group" v-if="occ.irregular_waste_present">
                  <label>
                    <input type="checkbox" v-model="occ.waste_removed" />
                    Remoção realizada?
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>Fotos para Evidenciar</label>
                <input type="file" multiple accept="image/*" @change="handleFencePhotos($event, idx)" />
                <small v-if="occ.photos && occ.photos.length">{{ occ.photos.length }} foto(s) selecionada(s)</small>
              </div>

              <div class="form-group">
                <label>Notas</label>
                <textarea v-model="occ.notes" rows="2"></textarea>
              </div>

              <button type="button" @click="removerOcorrenciaCerca(idx)" class="btn-danger-sm">Remover Ocorrência</button>
            </div>
          </section>

          <!-- Seção 3: Portões Operacionais -->
          <section class="form-section">
            <h4>3. Portões Operacionais</h4>

            <button type="button" @click="adicionarOcorrenciaPortao" class="btn btn-sm">+ Adicionar Ocorrência em Portão</button>

            <div v-for="(occ, idx) in form.gate_occurrences" :key="idx" class="nested-item">
              <h5>Ocorrência em Portão #{{ idx + 1 }}</h5>

              <div class="form-group">
                <label>Localização do Registro *</label>
                <input type="text" v-model="occ.location_text" required />
              </div>

              <div class="form-group">
                <label>Tipos de Ocorrência (seleção múltipla)</label>
                <div class="checkbox-list">
                  <label v-for="tipo in lookups.tipos_ocorrencia_portao" :key="tipo.id">
                    <input
                      type="checkbox"
                      :value="tipo.id"
                      v-model="occ.occurrence_types"
                    />
                    {{ tipo.name }}
                  </label>
                </div>
              </div>

              <div class="form-group" v-if="occ.occurrence_types?.includes(getOtrosId())">
                <label>Outros (especifique)</label>
                <input type="text" v-model="occ.other_occurrence" />
              </div>

              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="occ.repair_performed" />
                    Reparo realizado?
                  </label>
                </div>
                <div class="form-group" v-if="occ.repair_performed">
                  <label>Data do Reparo</label>
                  <input type="date" v-model="occ.repair_date" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" v-model="occ.irregular_waste_present" />
                    Presença de descarte irregular de resíduos?
                  </label>
                </div>
                <div class="form-group checkbox-group" v-if="occ.irregular_waste_present">
                  <label>
                    <input type="checkbox" v-model="occ.waste_removed" />
                    Remoção realizada?
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>Fotos para Evidenciar</label>
                <input type="file" multiple accept="image/*" @change="handleGatePhotos($event, idx)" />
                <small v-if="occ.photos && occ.photos.length">{{ occ.photos.length}} foto(s) selecionada(s)</small>
              </div>

              <div class="form-group">
                <label>Notas</label>
                <textarea v-model="occ.notes" rows="2"></textarea>
              </div>

              <button type="button" @click="removerOcorrenciaPortao(idx)" class="btn-danger-sm">Remover Ocorrência</button>
            </div>
          </section>

          <!-- Seção 4: Observações Gerais -->
          <section class="form-section">
            <h4>4. Observações Gerais</h4>

            <div class="form-group">
              <label>Observações Gerais</label>
              <textarea v-model="form.general_notes" rows="4" placeholder="Campo de texto livre para registros complementares"></textarea>
            </div>

            <div class="form-group">
              <label>Fotos Gerais (até 5 fotos)</label>
              <input type="file" multiple accept="image/*" @change="handleGeneralPhotos" :disabled="form.general_photos && form.general_photos.length >= 5" />
              <small v-if="form.general_photos && form.general_photos.length">
                {{ form.general_photos.length }} foto(s) selecionada(s) (máximo 5)
              </small>
            </div>
          </section>

          <!-- Botões de Ação -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="salvando">
              {{ salvando ? 'Salvando...' : (modoEdicao ? 'Atualizar' : 'Salvar') }}
            </button>
            <button type="button" @click="cancelarEdicao" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ApiService } from '@/services/api';
import { inspectionTemplates } from '@/constants/inspectionTemplates';
import FormTypeSelector from '@/components/FormTypeSelector.vue';

// Estado
const inspecoes = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const router = useRouter();
const selectorTemplates = inspectionTemplates.filter((template) => template.id !== 'legacy');
const selectedTemplateId = ref('f4');

function handleTemplateChange(id: string) {
  selectedTemplateId.value = id;
  if (id === 'f4') return;
  const template = selectorTemplates.find((entry) => entry.id === id);
  if (template?.externalRoute) {
    router.push(template.externalRoute);
  } else {
    router.push('/inspecoes');
  }
}

const lookups = ref<any>({
  estacoes_ano: [],
  tipos_ocorrencia_cerca: [],
  tipos_ocorrencia_portao: []
});

const inspecaoSelecionada = ref<any>(null);
const modoEdicao = ref(false);
const salvando = ref(false);

const filtros = reactive({
  inicio: '',
  fim: ''
});

const formPadrao = () => ({
  airport_id: '',
  inspection_date: new Date().toISOString().split('T')[0],
  season_id: '',
  rained_last_24h: false,
  general_notes: '',
  fence_occurrences: [],
  gate_occurrences: [],
  general_photos: []
});

const form = reactive(formPadrao());

// Métodos
async function carregarDados() {
  try {
    const [aero, look] = await Promise.all([
      ApiService.getAeroportos(),
      ApiService.getLookups()
    ]);
    aeroportos.value = aero;
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

    const response = await ApiService.getInspecoesProtecao(params);
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
  // Note: Editing with photos not fully implemented - would need to fetch existing photos
  alert('Edição de inspeções de proteção com fotos ainda não implementada. Crie uma nova inspeção.');
}

async function salvarInspecao() {
  if (salvando.value) return;

  try {
    salvando.value = true;

    // Create FormData for multipart upload
    const formData = new FormData();

    // Add JSON payload
    const payload = {
      airport_id: form.airport_id,
      inspection_date: form.inspection_date,
      season_id: form.season_id || undefined,
      rained_last_24h: form.rained_last_24h,
      general_notes: form.general_notes,
      fence_occurrences: form.fence_occurrences.map((f: any) => ({
        location_text: f.location_text,
        occurrence_types: f.occurrence_types || [],
        repair_performed: f.repair_performed,
        repair_date: f.repair_date,
        irregular_waste_present: f.irregular_waste_present,
        waste_removed: f.waste_removed,
        notes: f.notes
      })),
      gate_occurrences: form.gate_occurrences.map((g: any) => ({
        location_text: g.location_text,
        occurrence_types: g.occurrence_types || [],
        other_occurrence: g.other_occurrence,
        repair_performed: g.repair_performed,
        repair_date: g.repair_date,
        irregular_waste_present: g.irregular_waste_present,
        waste_removed: g.waste_removed,
        notes: g.notes
      }))
    };

    formData.append('payload', JSON.stringify(payload));

    // Add general photos
    if (form.general_photos && form.general_photos.length > 0) {
      for (let i = 0; i < Math.min(form.general_photos.length, 5); i++) {
        formData.append(`general_photo_${i}`, form.general_photos[i]);
      }
    }

    // Add fence photos
    form.fence_occurrences.forEach((fence: any, fenceIdx: number) => {
      if (fence.photos && fence.photos.length > 0) {
        fence.photos.forEach((photo: File, photoIdx: number) => {
          formData.append(`fence_photo_${fenceIdx}_${photoIdx}`, photo);
        });
      }
    });

    // Add gate photos
    form.gate_occurrences.forEach((gate: any, gateIdx: number) => {
      if (gate.photos && gate.photos.length > 0) {
        gate.photos.forEach((photo: File, photoIdx: number) => {
          formData.append(`gate_photo_${gateIdx}_${photoIdx}`, photo);
        });
      }
    });

    await ApiService.criarInspecaoProtecao(formData);
    alert('Inspeção criada com sucesso!');

    await carregarInspecoes();
    novaInspecao();
  } catch (error: any) {
    console.error('Erro ao salvar inspeção:', error);
    alert('Erro ao salvar inspeção: ' + (error.response?.data?.message || error.message));
  } finally {
    salvando.value = false;
  }
}

async function removerInspecao(id: number) {
  if (!confirm('Deseja realmente remover esta inspeção?')) return;

  try {
    await ApiService.removerInspecaoProtecao(id);
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

// Métodos auxiliares
function adicionarOcorrenciaCerca() {
  form.fence_occurrences.push({
    location_text: '',
    occurrence_types: [],
    repair_performed: false,
    repair_date: '',
    irregular_waste_present: false,
    waste_removed: false,
    notes: '',
    photos: []
  });
}

function removerOcorrenciaCerca(idx: number) {
  form.fence_occurrences.splice(idx, 1);
}

function adicionarOcorrenciaPortao() {
  form.gate_occurrences.push({
    location_text: '',
    occurrence_types: [],
    other_occurrence: '',
    repair_performed: false,
    repair_date: '',
    irregular_waste_present: false,
    waste_removed: false,
    notes: '',
    photos: []
  });
}

function removerOcorrenciaPortao(idx: number) {
  form.gate_occurrences.splice(idx, 1);
}

function handleFencePhotos(event: Event, idx: number) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    form.fence_occurrences[idx].photos = Array.from(target.files);
  }
}

function handleGatePhotos(event: Event, idx: number) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    form.gate_occurrences[idx].photos = Array.from(target.files);
  }
}

function handleGeneralPhotos(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    form.general_photos = Array.from(target.files).slice(0, 5);
  }
}

function getOtrosId(): number {
  return lookups.value.tipos_ocorrencia_portao?.find((t: any) => t.name === 'Outros')?.id || 0;
}

function formatarData(data: string) {
  if (!data) return '';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

async function exportar(formato: 'pdf' | 'docx') {
  try {
    const params: any = { formato };
    if (filtros.inicio) params.inicio = filtros.inicio;
    if (filtros.fim) params.fim = filtros.fim;

    const response = await ApiService.exportarInspecoesProtecao(params);

    const contentType =
      response.headers['content-type'] ??
      (formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nomeHeader = response.headers['content-disposition'] ?? '';
    const filename =
      nomeHeader.split('filename=').pop()?.replace(/"/g, '') ??
      `inspecoes-protecao-${filtros.inicio || 'inicio'}-${filtros.fim || 'fim'}.${formato}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error(`Erro ao exportar ${formato.toUpperCase()}:`, error);
    if (error.response?.status === 404) {
      alert('Nenhuma inspeção encontrada para o período informado');
    } else {
      alert(`Erro ao exportar ${formato.toUpperCase()}: ` + (error.message || 'Erro desconhecido'));
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
/* Reutiliza os mesmos estilos da InspecoesDiariasView.vue */
.inspecoes-protecao-container {
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
  border-color: #27ae60;
}

.inspection-card.active {
  background: #e8f5e9;
  border-color: #27ae60;
}

.inspection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge {
  background: #27ae60;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.info-rain {
  color: #3498db;
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
  border-bottom: 2px solid #27ae60;
  padding-bottom: 8px;
}

.form-section h5 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #34495e;
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
  border-color: #27ae60;
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
  background: #27ae60;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #229954;
}

.btn-primary:disabled {
  background: #95a5a6;
  cursor: not-allowed;
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
