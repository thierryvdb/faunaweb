<template>
  <div class="residuos-incineracao-container">
    <h1 class="page-title">Resíduos Enviados para Incineração</h1>
    <p class="subtitle">Controle de resíduos de risco biológico provenientes de voos internacionais</p>

    <div class="two-column-layout">
      <!-- Lista de Resíduos -->
      <div class="left-column">
        <div class="toolbar">
          <h2>Registros de Resíduos</h2>
          <button @click="novoResiduo" class="btn btn-primary">+ Novo Registro</button>
        </div>

        <div class="filters">
          <div class="filter-group">
            <label>Período:</label>
            <input type="date" v-model="filtros.inicio" />
            <span>até</span>
            <input type="date" v-model="filtros.fim" />
          </div>
          <button @click="carregarResiduos" class="btn btn-secondary">Filtrar</button>
          <button @click="exportarPDF" class="btn btn-secondary">📄 PDF</button>
          <button @click="exportarDOCX" class="btn btn-secondary">📝 DOCX</button>
        </div>

        <div class="residuos-list">
          <div
            v-for="res in residuos"
            :key="res.waste_id"
            :class="['residuo-card', { active: residuoSelecionado?.waste_id === res.waste_id }]"
            @click="editarResiduo(res)"
          >
            <div class="residuo-header">
              <strong>{{ formatarData(res.record_date) }}</strong>
              <span v-if="res.international_flights" class="badge badge-intl">Internacional</span>
            </div>
            <div class="residuo-details">
              <p class="company-name">{{ res.company_name }}</p>
              <p v-if="res.waste_type" class="waste-type">{{ res.waste_type }}</p>
              <p v-if="res.treatment_name" class="treatment">
                <small>Tratamento: {{ res.treatment_name }}</small>
              </p>
            </div>
            <div class="residuo-actions">
              <button @click.stop="removerResiduo(res.waste_id)" class="btn-danger-sm">Remover</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Formulário de Resíduo -->
      <div class="right-column">
        <form @submit.prevent="salvarResiduo" class="residuo-form">
          <h3>{{ modoEdicao ? 'Editar Registro' : 'Novo Registro' }}</h3>

          <!-- Informações Gerais -->
          <section class="form-section">
            <h4>Informações do Registro</h4>

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
              <div class="form-group">
                <label>Data do Registro *</label>
                <input type="date" v-model="form.record_date" required />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Empresa Geradora *</label>
                <input type="text" v-model="form.company_name" required placeholder="Nome da empresa" />
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input type="checkbox" v-model="form.international_flights" />
                  Voos Internacionais?
                </label>
              </div>
            </div>
          </section>

          <!-- Características do Resíduo -->
          <section class="form-section">
            <h4>Características do Resíduo</h4>

            <div class="form-group">
              <label>Tipo de Resíduo</label>
              <input type="text" v-model="form.waste_type" placeholder="Descreva o tipo de resíduo" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Estado Físico</label>
                <select v-model="form.physical_state_id">
                  <option value="">Selecione...</option>
                  <option v-for="e in lookups.estados_fisicos_residuo" :key="e.id" :value="e.id">
                    {{ e.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Origem</label>
                <input type="text" v-model="form.origin" placeholder="Procedência do resíduo" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Codificação (NBR 10004/25 e IBAMA)</label>
                <input type="text" v-model="form.codification" placeholder="Ex: Classe I - A001" />
              </div>
              <div class="form-group">
                <label>Frequência de Geração</label>
                <input type="text" v-model="form.generation_frequency" placeholder="Ex: Diária, Semanal" />
              </div>
            </div>
          </section>

          <!-- Quantificação -->
          <section class="form-section">
            <h4>Quantificação</h4>

            <div class="form-row">
              <div class="form-group">
                <label>Peso (kg)</label>
                <input
                  type="number"
                  v-model.number="form.weight_kg"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
              <div class="form-group">
                <label>Quantidade de Unidades</label>
                <input
                  type="number"
                  v-model.number="form.unit_quantity"
                  min="0"
                  placeholder="Número de unidades"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Volume</label>
                <input
                  type="number"
                  v-model.number="form.volume_value"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
              <div class="form-group">
                <label>Unidade de Volume</label>
                <input type="text" v-model="form.volume_unit" placeholder="L ou m³" />
              </div>
            </div>
          </section>

          <!-- Tratamento e Destinação -->
          <section class="form-section">
            <h4>Tratamento e Destinação</h4>

            <div class="form-row">
              <div class="form-group">
                <label>Tipo de Tratamento</label>
                <select v-model="form.treatment_id">
                  <option value="">Selecione...</option>
                  <option v-for="t in lookups.tipos_tratamento_residuo" :key="t.id" :value="t.id">
                    {{ t.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Outro Tratamento (especificar)</label>
                <input type="text" v-model="form.treatment_other" placeholder="Se não listado acima" />
              </div>
            </div>
          </section>

          <!-- Responsável -->
          <section class="form-section">
            <h4>Responsável pelo Preenchimento</h4>

            <div class="form-group">
              <label>Preenchido por</label>
              <input type="text" v-model="form.filled_by" placeholder="Nome do responsável" />
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
import { ref, reactive, onMounted } from 'vue';
import { ApiService } from '../services/api';

// Estado
const residuos = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({
  estados_fisicos_residuo: [],
  tipos_tratamento_residuo: []
});

const residuoSelecionado = ref<any>(null);
const modoEdicao = ref(false);

const filtros = reactive({
  inicio: '',
  fim: ''
});

const formPadrao = () => ({
  airport_id: '',
  company_name: '',
  record_date: new Date().toISOString().split('T')[0],
  international_flights: false,
  waste_type: '',
  physical_state_id: '',
  origin: '',
  codification: '',
  generation_frequency: '',
  weight_kg: null,
  unit_quantity: null,
  volume_value: null,
  volume_unit: '',
  treatment_id: '',
  treatment_other: '',
  filled_by: ''
});

const form = reactive(formPadrao());

// Métodos
async function carregarDados() {
  try {
    const cadastros = await ApiService.getCadastros();
    aeroportos.value = cadastros.aeroportos || [];
    lookups.value = cadastros.lookups || { estados_fisicos_residuo: [], tipos_tratamento_residuo: [] };
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    alert('Erro ao carregar dados iniciais');
  }
}

async function carregarResiduos() {
  try {
    const params: any = {};
    if (filtros.inicio) params.inicio = filtros.inicio;
    if (filtros.fim) params.fim = filtros.fim;

    const response = await ApiService.getResiduosIncineracao(params);
    residuos.value = response.residuos || [];
  } catch (error) {
    console.error('Erro ao carregar resíduos:', error);
    alert('Erro ao carregar resíduos');
  }
}

function novoResiduo() {
  Object.assign(form, formPadrao());
  residuoSelecionado.value = null;
  modoEdicao.value = false;
}

function editarResiduo(residuo: any) {
  residuoSelecionado.value = residuo;
  modoEdicao.value = true;

  Object.assign(form, {
    airport_id: residuo.airport_id,
    company_name: residuo.company_name || '',
    record_date: residuo.record_date,
    international_flights: residuo.international_flights || false,
    waste_type: residuo.waste_type || '',
    physical_state_id: residuo.physical_state_id || '',
    origin: residuo.origin || '',
    codification: residuo.codification || '',
    generation_frequency: residuo.generation_frequency || '',
    weight_kg: residuo.weight_kg,
    unit_quantity: residuo.unit_quantity,
    volume_value: residuo.volume_value,
    volume_unit: residuo.volume_unit || '',
    treatment_id: residuo.treatment_id || '',
    treatment_other: residuo.treatment_other || '',
    filled_by: residuo.filled_by || ''
  });
}

async function salvarResiduo() {
  try {
    const payload = { ...form };

    if (modoEdicao.value && residuoSelecionado.value) {
      await ApiService.atualizarResiduoIncineracao(residuoSelecionado.value.waste_id, payload);
      alert('Registro atualizado com sucesso!');
    } else {
      await ApiService.criarResiduoIncineracao(payload);
      alert('Registro criado com sucesso!');
    }

    await carregarResiduos();
    novoResiduo();
  } catch (error: any) {
    console.error('Erro ao salvar registro:', error);
    alert('Erro ao salvar registro: ' + (error.response?.data?.message || error.message));
  }
}

async function removerResiduo(id: number) {
  if (!confirm('Deseja realmente remover este registro?')) return;

  try {
    await ApiService.removerResiduoIncineracao(id);
    alert('Registro removido com sucesso!');
    await carregarResiduos();
    if (residuoSelecionado.value?.waste_id === id) {
      novoResiduo();
    }
  } catch (error) {
    console.error('Erro ao remover registro:', error);
    alert('Erro ao remover registro');
  }
}

function cancelarEdicao() {
  novoResiduo();
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
    params.format = 'pdf';

    const response = await ApiService.exportarResiduosIncineracao(params);

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const filename = `residuos-incineracao-${filtros.inicio || 'inicio'}-${filtros.fim || 'fim'}.pdf`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Erro ao exportar PDF:', error);
    if (error.response?.status === 404) {
      alert('Nenhum registro encontrado para o período informado');
    } else {
      alert('Erro ao exportar PDF: ' + (error.message || 'Erro desconhecido'));
    }
  }
}

async function exportarDOCX() {
  try {
    const params: any = {};
    if (filtros.inicio) params.inicio = filtros.inicio;
    if (filtros.fim) params.fim = filtros.fim;
    params.format = 'docx';

    const response = await ApiService.exportarResiduosIncineracao(params);

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const filename = `residuos-incineracao-${filtros.inicio || 'inicio'}-${filtros.fim || 'fim'}.docx`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Erro ao exportar DOCX:', error);
    if (error.response?.status === 404) {
      alert('Nenhum registro encontrado para o período informado');
    } else {
      alert('Erro ao exportar DOCX: ' + (error.message || 'Erro desconhecido'));
    }
  }
}

// Lifecycle
onMounted(async () => {
  await carregarDados();
  await carregarResiduos();
});
</script>

<style scoped>
.residuos-incineracao-container {
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

.residuos-list {
  max-height: calc(100vh - 350px);
  overflow-y: auto;
}

.residuo-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.residuo-card:hover {
  background: #f8f9fa;
  border-color: #3498db;
}

.residuo-card.active {
  background: #e3f2fd;
  border-color: #2196f3;
}

.residuo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: white;
}

.badge-intl {
  background: #9b59b6;
}

.residuo-details {
  margin-bottom: 8px;
}

.company-name {
  font-weight: 600;
  margin: 4px 0;
  color: #2c3e50;
}

.waste-type {
  color: #7f8c8d;
  font-size: 14px;
  margin: 4px 0;
}

.treatment {
  margin: 4px 0;
}

.residuo-actions {
  margin-top: 8px;
}

.residuo-form {
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

.btn-danger-sm {
  padding: 4px 8px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
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
