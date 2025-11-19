<template>
  <div class="coletas-carcaca-container">
    <FormTypeSelector
      :items="selectorTemplates"
      :modelValue="selectedTemplateId"
      @update:modelValue="handleTemplateChange"
    />
    <h1 class="page-title">F5 – Coleta e Destinação de Carcaça</h1>
    <p class="subtitle">Registro de carcaças de fauna encontradas no sítio aeroportuário.</p>

    <div class="two-column-layout">
      <!-- Coluna da Esquerda: Lista de Coletas -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Registros de Coleta</h2>
          <button @click="novaColeta" class="btn btn-primary">+ Novo Registro</button>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label>Período:</label>
            <input type="date" v-model="filtros.inicio" />
            <span>até</span>
            <input type="date" v-model="filtros.fim" />
          </div>
          <button @click="carregarColetas" class="btn btn-secondary">Filtrar</button>
          <button @click="exportar('pdf')" class="btn btn-secondary">📄 PDF</button>
          <button @click="exportar('docx')" class="btn btn-secondary">📝 DOCX</button>
        </div>

        <div class="coletas-list">
          <div
            v-for="coleta in coletas"
            :key="coleta.collection_id"
            :class="['coleta-card', { active: coletaSelecionada?.collection_id === coleta.collection_id }]"
            @click="selecionarColeta(coleta)"
          >
            <div class="coleta-header">
              <strong>{{ formatarData(coleta.collection_date) }}</strong>
              <span class="badge badge-airport">{{ coleta.icao_code }}</span>
            </div>
            <div class="coleta-details">
              <p class="species-name">{{ coleta.common_name || coleta.scientific_name || 'Espécie não informada' }}</p>
              <p v-if="coleta.runway_ref" class="location">
                <small>Pista: {{ coleta.runway_ref }} | Quadrante: {{ coleta.quadrant_code || 'N/A' }}</small>
              </p>
            </div>
            <div class="coleta-actions">
              <button @click.stop="removerColeta(coleta.collection_id)" class="btn-danger-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Coluna da Direita: Formulário -->
      <div class="right-column">
        <form @submit.prevent="salvarColeta" class="coleta-form">
          <h3>{{ modoEdicao ? 'Visualizando Registro' : 'Novo Registro de Coleta' }}</h3>

          <!-- Seção de Informações Gerais -->
          <section class="form-section">
            <h4>Informações Gerais</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Aeroporto *</label>
                <select v-model="form.airport_id" required :disabled="modoEdicao">
                  <option value="">Selecione...</option>
                  <option v-for="a in aeroportos" :key="a.airport_id" :value="a.airport_id">
                    {{ a.icao_code }} - {{ a.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Data da Coleta *</label>
                <input type="date" v-model="form.collection_date" required :disabled="modoEdicao" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Responsável pelo Preenchimento</label>
                <input type="text" v-model="form.filled_by" placeholder="Nome do responsável" :disabled="modoEdicao" />
              </div>
              <div class="form-group">
                <label>Responsável pela Entrega</label>
                <input type="text" v-model="form.delivered_by" placeholder="Nome de quem entregou" :disabled="modoEdicao" />
              </div>
            </div>
          </section>

          <!-- Seção de Localização -->
          <section class="form-section">
            <h4>Localização do Evento</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Pista</label>
                <input type="text" v-model="form.runway_ref" placeholder="Ex: 10/28" :disabled="modoEdicao" />
              </div>
              <div class="form-group">
                <label>Quadrante</label>
                <select v-model="form.quadrant_id" :disabled="modoEdicao">
                  <option value="">Selecione...</option>
                  <option v-for="q in quadrantes" :key="q.quadrant_id" :value="q.quadrant_id">
                    {{ q.code }}
                  </option>
                </select>
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="form.found_during_inspection" :disabled="modoEdicao" />
                Encontrada durante inspeção de pista?
              </label>
            </div>
          </section>

          <!-- Seção de Informações da Carcaça -->
          <section class="form-section">
            <h4>Informações sobre a Carcaça</h4>
            <div class="form-group">
              <label>Destinação do Material</label>
              <input type="text" v-model="form.destination_text" placeholder="Ex: Incineração, descarte, etc." :disabled="modoEdicao" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Nome Popular</label>
                <input type="text" v-model="form.common_name" placeholder="Ex: Quero-quero" :disabled="modoEdicao" />
              </div>
              <div class="form-group">
                <label>Nome Científico</label>
                <input type="text" v-model="form.scientific_name" placeholder="Ex: Vanellus chilensis" :disabled="modoEdicao" />
              </div>
            </div>
            <div class="form-group">
              <label>Número de Indivíduos</label>
              <input type="number" v-model.number="form.individual_count" min="1" :disabled="modoEdicao" />
            </div>
          </section>

          <!-- Seção de Fotos -->
          <section class="form-section">
            <h4>Registro Fotográfico</h4>
            <div class="form-group">
              <label>Fotos Anexadas</label>
              <input
                type="file"
                @change="handleFileUpload"
                multiple
                accept="image/*"
                :disabled="modoEdicao"
              />
              <div v-if="form.photos.length" class="photo-preview-container">
                <div v-for="(photo, index) in form.photos" :key="index" class="photo-preview">
                  <img :src="getPhotoURL(photo)" alt="Preview" />
                  <button type="button" @click="removerFoto(index)" class="btn-remove-photo" v-if="!modoEdicao">X</button>
                </div>
              </div>
              <p v-if="modoEdicao && coletaSelecionada?.photo_count > 0">
                Este registro possui {{ coletaSelecionada.photo_count }} foto(s) anexada(s).
              </p>
            </div>
          </section>

          <!-- Seção de Observações -->
          <section class="form-section">
            <h4>Observações</h4>
            <div class="form-group">
              <textarea v-model="form.observations" rows="4" placeholder="Detalhes adicionais sobre a coleta." :disabled="modoEdicao"></textarea>
            </div>
          </section>

          <!-- Botões de Ação -->
          <div class="form-actions" v-if="!modoEdicao">
            <button type="submit" class="btn btn-primary">Salvar</button>
            <button type="button" @click="cancelarEdicao" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ApiService } from '@/services/api';
import { inspectionTemplates } from '@/constants/inspectionTemplates';
import FormTypeSelector from '@/components/FormTypeSelector.vue';

// Estado
const router = useRouter();
const selectorTemplates = inspectionTemplates.filter((template) => template.id !== 'legacy');
const selectedTemplateId = ref('f5');

function handleTemplateChange(id: string) {
  selectedTemplateId.value = id;
  if (id === 'f5') return;
  const template = selectorTemplates.find((entry) => entry.id === id);
  if (template?.externalRoute) {
    router.push(template.externalRoute);
  } else {
    router.push('/inspecoes');
  }
}

const coletas = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const quadrantes = ref<any[]>([]);
const coletaSelecionada = ref<any>(null);
const modoEdicao = ref(false);

const filtros = reactive({
  inicio: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  fim: new Date().toISOString().split('T')[0],
});

const formPadrao = () => ({
  airport_id: '',
  collection_date: new Date().toISOString().split('T')[0],
  filled_by: '',
  delivered_by: '',
  runway_ref: '',
  quadrant_id: '',
  found_during_inspection: false,
  destination_text: '',
  common_name: '',
  scientific_name: '',
  individual_count: 1,
  photos: [] as File[],
  observations: '',
});

const form = reactive(formPadrao());

// Métodos
async function carregarDadosIniciais() {
  try {
    const data = await ApiService.getCadastros();
    aeroportos.value = data.aeroportos || [];
    quadrantes.value = data.lookups?.quadrantes || [];
  } catch (error) {
    console.error('Erro ao carregar dados iniciais:', error);
    alert('Falha ao carregar dados de suporte.');
  }
}

async function carregarColetas() {
  try {
    const params: any = {
      inicio: filtros.inicio,
      fim: filtros.fim,
    };
    const response = await ApiService.getColetasCarcaca(params);
    coletas.value = response.coletas || [];
  } catch (error) {
    console.error('Erro ao carregar coletas:', error);
    alert('Falha ao carregar registros de coleta.');
  }
}

function novaColeta() {
  Object.assign(form, formPadrao());
  coletaSelecionada.value = null;
  modoEdicao.value = false;
}

function selecionarColeta(coleta: any) {
  coletaSelecionada.value = coleta;
  modoEdicao.value = true;
  Object.assign(form, {
    ...coleta,
    collection_date: coleta.collection_date.split('T')[0],
    photos: [], // Não carregamos as fotos para edição, apenas exibimos a contagem
  });
}

function cancelarEdicao() {
  novaColeta();
}

async function salvarColeta() {
  if (modoEdicao.value) return;

  const formData = new FormData();
  const payload = { ...form };
  delete payload.photos;

  formData.append('payload', JSON.stringify(payload));
  form.photos.forEach((photo, index) => {
    formData.append(`photo_${index}`, photo);
  });

  try {
    await ApiService.criarColetaCarcaca(formData);
    alert('Registro de coleta salvo com sucesso!');
    await carregarColetas();
    novaColeta();
  } catch (error: any) {
    console.error('Erro ao salvar coleta:', error);
    alert('Erro ao salvar: ' + (error.response?.data?.message || error.message));
  }
}

async function removerColeta(id: number) {
  if (!confirm('Deseja realmente remover este registro de coleta?')) return;

  try {
    await ApiService.removerColetaCarcaca(id);
    alert('Registro removido com sucesso!');
    await carregarColetas();
    if (coletaSelecionada.value?.collection_id === id) {
      novaColeta();
    }
  } catch (error) {
    console.error('Erro ao remover coleta:', error);
    alert('Falha ao remover o registro.');
  }
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    form.photos.push(...Array.from(target.files));
  }
}

function removerFoto(index: number) {
  form.photos.splice(index, 1);
}

function getPhotoURL(photo: File) {
  return URL.createObjectURL(photo);
}

function formatarData(data: string) {
  if (!data) return '';
  const d = new Date(data);
  // Adiciona o fuso horário para corrigir a data
  const offset = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() + offset);
  return d.toLocaleDateString('pt-BR');
}

async function exportar(formato: 'pdf' | 'docx') {
  try {
    const params = { ...filtros, formato };
    const response = await ApiService.exportarColetasCarcaca(params);

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers['content-disposition'];
    let filename = `coletas-carcaca.${formato}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch.length > 1) {
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
  await carregarColetas();
});
</script>

<style scoped>
.coletas-carcaca-container {
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
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.coletas-list {
  max-height: calc(100vh - 350px);
  overflow-y: auto;
}

.coleta-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.coleta-card:hover {
  background: #f8f9fa;
  border-color: #c0392b;
}

.coleta-card.active {
  background: #fbe9e7;
  border-color: #e74c3c;
}

.coleta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge-airport {
  background-color: #34495e;
  color: white;
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 12px;
}

.species-name {
  font-weight: 600;
  color: #2c3e50;
}

.location {
  color: #7f8c8d;
  font-size: 13px;
}

.coleta-actions {
  margin-top: 8px;
}

.coleta-form {
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
  border-bottom: 2px solid #e74c3c;
  padding-bottom: 8px;
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
  border-color: #e74c3c;
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e0e0e0;
}

.photo-preview-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }

.photo-preview {
  position: relative;
  width: 100px;
  height: 100px;
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.btn-remove-photo {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #c0392b;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-weight: bold;
  line-height: 20px;
  text-align: center;
}

/* Estilos de botões e outros elementos comuns */
.btn { padding: 10px 20px; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: #e74c3c; color: white; }
.btn-primary:hover { background: #c0392b; }
.btn-secondary { background: #95a5a6; color: white; }
.btn-secondary:hover { background: #7f8c8d; }
.btn-danger-sm { padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
.btn-danger-sm:hover { background: #c0392b; }

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

.two-column-layout {
  grid-template-columns: minmax(360px, 420px) 1fr;
  gap: 24px;
  align-items: flex-start;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.toolbar {
  gap: 12px;
  flex-wrap: wrap;
}

.form-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
}

.form-section h4 {
  color: var(--color-text-primary);
  border-bottom: 2px solid var(--color-border);
}

.form-section h5 {
  color: var(--color-text-primary);
}

.help-text {
  color: var(--color-text-secondary);
}
</style>
