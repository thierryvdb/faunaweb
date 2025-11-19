<template>
  <div class="inspecoes-lagos-container">
    <h1 class="page-title">Inspeção de Lagos e Áreas Alagadiças</h1>
    <p class="subtitle">Monitoramento de corpos d'água e fauna associada no sítio aeroportuário.</p>

    <div class="two-column-layout">
      <!-- Coluna da Esquerda: Lista de Inspeções -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Registros de Inspeção</h2>
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
            :key="insp.inspection_id"
            :class="['inspecao-card', { active: inspecaoSelecionada?.inspection_id === insp.inspection_id }]"
            @click="selecionarInspecao(insp)"
          >
            <div class="inspecao-header">
              <strong>{{ formatarData(insp.inspection_date) }}</strong>
              <span class="badge badge-airport">{{ insp.icao_code }}</span>
            </div>
            <div class="inspecao-details">
              <p v-if="insp.fauna_present" class="fauna-present">
                <span class="fauna-badge">FAUNA</span> {{ insp.species_popular_name || 'Espécie não informada' }}
              </p>
              <p v-else class="fauna-absent">Sem registro de fauna</p>
              <p class="location">
                <small>Pista: {{ insp.runway_ref || 'N/A' }} | Quadrante: {{ insp.quadrant_code || 'N/A' }}</small>
              </p>
            </div>
            <div class="inspecao-actions">
              <button @click.stop="removerInspecao(insp.inspection_id)" class="btn-danger-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Coluna da Direita: Formulário -->
      <div class="right-column">
        <form @submit.prevent="salvarInspecao" class="inspecao-form">
          <h3>{{ modoEdicao ? 'Visualizando Registro' : 'Nova Inspeção' }}</h3>

          <section class="form-section">
            <h4>Informações Gerais</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Data *</label>
                <input type="date" v-model="form.inspection_date" required :disabled="modoEdicao" />
              </div>
              <div class="form-group">
                <label>Período do Ano *</label>
                <select v-model="form.season_id" required :disabled="modoEdicao">
                  <option v-for="s in lookups.seasons" :key="s.season_id" :value="s.season_id">{{ s.name }}</option>
                </select>
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" v-model="form.rained_last_24h" :disabled="modoEdicao" /> Houve chuva nas últimas 24h?</label>
            </div>
          </section>

          <section class="form-section">
            <h4>Identificação do Ponto</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Pista Associada</label>
                <input type="text" v-model="form.runway_ref" placeholder="Ex: 10/28" :disabled="modoEdicao" />
              </div>
              <div class="form-group">
                <label>Quadrante</label>
                <select v-model="form.quadrant_id" :disabled="modoEdicao">
                  <option value="">Nenhum</option>
                  <option v-for="q in quadrantes" :key="q.quadrant_id" :value="q.quadrant_id">{{ q.code }}</option>
                </select>
              </div>
            </div>
          </section>

          <section class="form-section">
            <h4>Registro de Fauna</h4>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" v-model="form.fauna_present" :disabled="modoEdicao" /> Presença de fauna?</label>
            </div>
            <div v-if="form.fauna_present" class="form-row">
              <div class="form-group">
                <label>Nome Popular</label>
                <input type="text" v-model="form.species_popular_name" :disabled="modoEdicao" />
              </div>
              <div class="form-group">
                <label>Nome Científico</label>
                <input type="text" v-model="form.species_scientific_name" :disabled="modoEdicao" />
              </div>
            </div>
            <div v-if="form.fauna_present" class="form-group">
              <label>Número de Indivíduos</label>
              <input type="number" v-model.number="form.individual_count" min="1" :disabled="modoEdicao" />
            </div>
          </section>

          <section class="form-section">
            <h4>Análise do Sistema</h4>
            <div class="form-group">
              <label>Sistema Inspecionado</label>
              <input type="text" v-model="form.inspected_system" placeholder="Ex: Via Patrimonial" :disabled="modoEdicao" />
            </div>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" v-model="form.has_non_conformity" :disabled="modoEdicao" /> Sistema com inconformidade?</label>
            </div>
          </section>

          <section class="form-section">
            <h4>Registro Visual e Ações</h4>
            <div class="form-group">
              <label>Descrição da Situação</label>
              <textarea v-model="form.situation_description" rows="3" :disabled="modoEdicao"></textarea>
            </div>
            <div class="form-group">
              <label>Ação Mitigadora</label>
              <textarea v-model="form.mitigation_action" rows="3" :disabled="modoEdicao"></textarea>
            </div>
            <div class="form-group">
              <label>Fotos (até 5)</label>
              <input type="file" @change="handleFileUpload" multiple accept="image/*" :disabled="modoEdicao || form.photos.length >= 5" />
              <div v-if="form.photos.length" class="photo-preview-container">
                <div v-for="(photo, index) in form.photos" :key="index" class="photo-preview">
                  <img :src="getPhotoURL(photo)" alt="Preview" />
                  <button type="button" @click="removerFoto(index)" class="btn-remove-photo" v-if="!modoEdicao">X</button>
                </div>
              </div>
               <p v-if="modoEdicao && inspecaoSelecionada?.photo_count > 0">
                Este registro possui {{ inspecaoSelecionada.photo_count }} foto(s) anexada(s).
              </p>
            </div>
          </section>

          <section class="form-section">
            <h4>Observações Gerais</h4>
            <textarea v-model="form.general_observations" rows="4" :disabled="modoEdicao"></textarea>
          </section>

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
import { ApiService } from '../services/api';
import { inspectionTemplates } from '@/constants/inspectionTemplates';
import FormTypeSelector from '@/components/FormTypeSelector.vue';

const router = useRouter();
const selectorTemplates = inspectionTemplates.filter((template) => template.id !== 'legacy');
const selectedTemplateId = ref('lakes');

function handleTemplateChange(id: string) {
  selectedTemplateId.value = id;
  if (id === 'lakes') return;
  const template = selectorTemplates.find((entry) => entry.id === id);
  if (template?.externalRoute) {
    router.push(template.externalRoute);
  } else {
    router.push('/inspecoes');
  }
}

const inspecoes = ref<any[]>([]);
const lookups = ref<any>({ seasons: [] });
const quadrantes = ref<any[]>([]);
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
  runway_ref: '',
  quadrant_id: '',
  fauna_present: false,
  species_popular_name: '',
  species_scientific_name: '',
  individual_count: 1,
  inspected_system: '',
  has_non_conformity: false,
  situation_description: '',
  mitigation_action: '',
  general_observations: '',
  photos: [] as File[],
});

const form = reactive(formPadrao());

async function carregarDadosIniciais() {
  try {
    const data = await ApiService.getCadastros();
    lookups.value = data.lookups || { seasons: [] };
    quadrantes.value = data.quadrantes || [];
  } catch (error) {
    console.error('Erro ao carregar dados iniciais:', error);
  }
}

async function carregarInspecoes() {
  try {
    const response = await ApiService.getInspecoesLagos(filtros);
    inspecoes.value = response || [];
  } catch (error) {
    console.error('Erro ao carregar inspeções:', error);
    alert('Falha ao carregar inspeções.');
  }
}

function novaInspecao() {
  Object.assign(form, formPadrao());
  inspecaoSelecionada.value = null;
  modoEdicao.value = false;
}

function selecionarInspecao(insp: any) {
  inspecaoSelecionada.value = insp;
  modoEdicao.value = true;
  Object.assign(form, {
    ...insp,
    inspection_date: insp.inspection_date.split('T')[0],
    photos: [],
  });
}

function cancelarEdicao() {
  novaInspecao();
}

async function salvarInspecao() {
  if (modoEdicao.value) return;

  const formData = new FormData();
  const payload = { ...form };
  delete payload.photos;

  formData.append('payload', JSON.stringify(payload));
  form.photos.forEach((photo, index) => {
    formData.append(`photo_${index}`, photo);
  });

  try {
    await ApiService.criarInspecaoLago(formData);
    alert('Inspeção salva com sucesso!');
    await carregarInspecoes();
    novaInspecao();
  } catch (error: any) {
    console.error('Erro ao salvar inspeção:', error);
    alert('Erro ao salvar: ' + (error.response?.data?.message || error.message));
  }
}

async function removerInspecao(id: number) {
  if (!confirm('Deseja realmente remover esta inspeção?')) return;

  try {
    await ApiService.removerInspecaoLago(id);
    alert('Inspeção removida com sucesso!');
    await carregarInspecoes();
    if (inspecaoSelecionada.value?.inspection_id === id) {
      novaInspecao();
    }
  } catch (error) {
    console.error('Erro ao remover inspeção:', error);
    alert('Falha ao remover o registro.');
  }
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const newFiles = Array.from(target.files);
    const total = form.photos.length + newFiles.length;
    if (total > 5) {
      alert('Você pode anexar no máximo 5 fotos.');
      return;
    }
    form.photos.push(...newFiles);
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
  const offset = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() + offset);
  return d.toLocaleDateString('pt-BR');
}

async function exportar(formato: 'pdf' | 'docx') {
  try {
    const params = { ...filtros, formato };
    const response = await ApiService.exportarInspecoesLagos(params);

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = response.headers['content-disposition'];
    let filename = `inspecoes-lagos.${formato}`;
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
  await carregarInspecoes();
});
</script>

<style scoped>
/* Estilos gerais e layout de duas colunas (semelhantes a ColetasCarcacaView.vue) */
.inspecoes-lagos-container { padding: 20px; max-width: 1800px; margin: 0 auto; }
.page-title { font-size: 28px; margin-bottom: 10px; color: #2c3e50; }
.subtitle { color: #7f8c8d; margin-bottom: 20px; }
.two-column-layout { display: grid; grid-template-columns: 400px 1fr; gap: 20px; min-height: 600px; }
.left-column { border-right: 1px solid #ddd; padding-right: 20px; }
.right-column { overflow-y: auto; max-height: calc(100vh - 150px); }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.toolbar h2 { font-size: 18px; margin: 0; }
.filters { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 10px; }
.filter-group { display: flex; gap: 10px; align-items: center; }
.inspecoes-list { max-height: calc(100vh - 350px); overflow-y: auto; }

/* Estilos do Card */
.inspecao-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; }
.inspecao-card:hover { background: #f8f9fa; border-color: #16a085; }
.inspecao-card.active { background: #e8f8f5; border-color: #1abc9c; }
.inspecao-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.badge-airport { background-color: #34495e; color: white; padding: 3px 7px; border-radius: 4px; font-size: 12px; }
.fauna-present { font-weight: 600; color: #c0392b; }
.fauna-badge { background: #c0392b; color: white; padding: 2px 5px; border-radius: 3px; font-size: 10px; margin-right: 5px; }
.fauna-absent { color: #7f8c8d; font-style: italic; }
.location { color: #7f8c8d; font-size: 13px; }
.inspecao-actions { margin-top: 8px; }

/* Estilos do Formulário */
.inspecao-form { background: white; padding: 20px; border-radius: 8px; }
.form-section { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.form-section h4 { margin-top: 0; margin-bottom: 15px; color: #2c3e50; border-bottom: 2px solid #1abc9c; padding-bottom: 8px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
.form-group { display: flex; flex-direction: column; margin-bottom: 10px; }
.form-group label { font-weight: 600; margin-bottom: 5px; color: #34495e; }
.form-group input, .form-group select, .form-group textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #1abc9c; }
.checkbox-group { flex-direction: row; align-items: center; gap: 8px; }
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 2px solid #e0e0e0; }

/* Estilos de Fotos */
.photo-preview-container { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
.photo-preview { position: relative; width: 100px; height: 100px; }
.photo-preview img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.btn-remove-photo { position: absolute; top: -5px; right: -5px; background: #c0392b; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-weight: bold; line-height: 20px; text-align: center; }

/* Botões */
.btn { padding: 10px 20px; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: #1abc9c; color: white; }
.btn-primary:hover { background: #16a085; }
.btn-secondary { background: #95a5a6; color: white; }
.btn-secondary:hover { background: #7f8c8d; }
.btn-danger-sm { padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
.btn-danger-sm:hover { background: #c0392b; }

@media (max-width: 1200px) {
  .two-column-layout { grid-template-columns: 1fr; }
  .left-column { border-right: none; border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
}
</style>
