<template>
  <div class="asa-container">
    <header class="page-header">
      <div>
        <h1>ASA - Área de Segurança Aeroportuária</h1>
        <p class="subtitle">Gestão de focos atrativos de fauna no entorno do aeródromo</p>
      </div>
    </header>

    <section class="content-card">
      <header class="section-header">
        <div>
          <h2>Focos Atrativos na ASA</h2>
          <p>Registro atualizado por município, protocolo e status de mitigação</p>
        </div>
        <button v-if="canCreate" class="btn btn-primary" @click="novoFoco">+ Novo Foco</button>
      </header>

      <!-- Lista de Focos -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Município</th>
              <th>Tipo de Foco</th>
              <th>Descrição</th>
              <th>Distância (km)</th>
              <th>Status</th>
              <th>Protocolo</th>
              <th>Próximo Follow-up</th>
              <th>Responsável</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in focos" :key="item.asa_focus_id">
              <td>{{ item.municipality || '-' }}</td>
              <td>{{ item.focus_type || '-' }}</td>
              <td>{{ item.description || '-' }}</td>
              <td class="text-right">{{ item.distance_km ? item.distance_km.toFixed(1) : '-' }}</td>
              <td>
                <span :class="['status-badge', `status-${item.status}`]">
                  {{ focoStatus(item.status) }}
                </span>
              </td>
              <td>{{ item.protocol_ref || '-' }}</td>
              <td>{{ item.next_follow_up ? formatarData(item.next_follow_up) : '-' }}</td>
              <td>{{ item.responsible_org || '-' }}</td>
              <td>
                <button v-if="canUpdate" class="btn-icon" @click="editarFoco(item)" title="Editar">
                  ✏️
                </button>
                <button v-if="canDelete" class="btn-icon btn-danger" @click="removerFoco(item.asa_focus_id)" title="Remover">
                  🗑️
                </button>
                <span v-if="!canUpdate && !canDelete" class="text-muted">-</span>
              </td>
            </tr>
            <tr v-if="!focos.length">
              <td colspan="9" class="empty-state">Nenhum foco cadastrado na ASA</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Modal de Cadastro/Edição -->
    <div v-if="mostrarModal" class="modal-overlay" @click.self="fecharModal">
      <div class="modal-content">
        <header class="modal-header">
          <h3>{{ editandoId ? 'Editar Foco ASA' : 'Novo Foco ASA' }}</h3>
          <button class="btn-close" @click="fecharModal">×</button>
        </header>

        <form @submit.prevent="salvarFoco" class="modal-form">
          <div class="form-row">
            <div class="form-group">
              <label>Município *</label>
              <input type="text" v-model="formFoco.municipality" required placeholder="Nome do município" />
            </div>

            <div class="form-group">
              <label>Tipo de Foco</label>
              <select v-model="formFoco.focus_type">
                <option value="">Selecione...</option>
                <option value="aterro_sanitario">Aterro Sanitário</option>
                <option value="lixao">Lixão</option>
                <option value="lagoa">Lagoa/Açude</option>
                <option value="cultivo_agricola">Cultivo Agrícola</option>
                <option value="frigorifero">Frigorífico</option>
                <option value="matadouro">Matadouro</option>
                <option value="criatório_animais">Criatório de Animais</option>
                <option value="area_florestal">Área Florestal</option>
                <option value="outros">Outros</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Descrição</label>
            <textarea v-model="formFoco.description" rows="3" placeholder="Descreva o foco atrativo identificado"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Distância do Aeródromo (km)</label>
              <input type="number" v-model.number="formFoco.distance_km" min="0" step="0.1" placeholder="0.0" />
            </div>

            <div class="form-group">
              <label>Status *</label>
              <select v-model="formFoco.status" required>
                <option value="monitorado">Monitorado</option>
                <option value="em_gestao">Em Gestão</option>
                <option value="mitigado">Mitigado</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Organização Responsável</label>
              <input type="text" v-model="formFoco.responsible_org" placeholder="Ex: Prefeitura Municipal" />
            </div>

            <div class="form-group">
              <label>Número do Protocolo</label>
              <input type="text" v-model="formFoco.protocol_ref" placeholder="Ex: OF-2024-001" />
            </div>
          </div>

          <div class="form-group">
            <label>Próximo Follow-up</label>
            <input type="date" v-model="formFoco.next_follow_up" />
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="fecharModal">Cancelar</button>
            <button type="submit" class="btn btn-primary" :disabled="salvandoFoco">
              {{ salvandoFoco ? 'Salvando...' : (editandoId ? 'Atualizar' : 'Salvar') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ApiService } from '@/services/api';
import { usePermissions } from '@/composables/usePermissions';

const { canCreate, canUpdate, canDelete } = usePermissions();

const focos = ref<any[]>([]);
const mostrarModal = ref(false);
const editandoId = ref<number | null>(null);
const salvandoFoco = ref(false);

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

function airportIdAtual() {
  return ApiService.getUser<any>()?.aeroporto_id ?? 1;
}

async function carregarFocos() {
  const data = await ApiService.getAsaFocos({ airportId: airportIdAtual() });
  focos.value = data;
}

function novoFoco() {
  editandoId.value = null;
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
  mostrarModal.value = true;
}

function editarFoco(foco: any) {
  editandoId.value = foco.asa_focus_id;
  Object.assign(formFoco, {
    municipality: foco.municipality || '',
    focus_type: foco.focus_type || '',
    description: foco.description || '',
    distance_km: foco.distance_km,
    status: foco.status || 'monitorado',
    responsible_org: foco.responsible_org || '',
    protocol_ref: foco.protocol_ref || '',
    next_follow_up: foco.next_follow_up || ''
  });
  mostrarModal.value = true;
}

async function salvarFoco() {
  salvandoFoco.value = true;
  try {
    const payload = {
      ...formFoco,
      airport_id: airportIdAtual()
    };

    if (editandoId.value) {
      await ApiService.atualizarAsaFoco(editandoId.value, payload);
    } else {
      await ApiService.criarAsaFoco(payload);
    }

    await carregarFocos();
    fecharModal();
  } catch (error: any) {
    console.error('Erro ao salvar foco:', error);
    alert('Erro ao salvar foco: ' + (error.message || 'Erro desconhecido'));
  } finally {
    salvandoFoco.value = false;
  }
}

async function removerFoco(id: number) {
  if (!confirm('Deseja realmente remover este foco da ASA?')) return;

  try {
    await ApiService.removerAsaFoco(id);
    await carregarFocos();
  } catch (error: any) {
    console.error('Erro ao remover foco:', error);
    alert('Erro ao remover foco');
  }
}

function fecharModal() {
  mostrarModal.value = false;
  editandoId.value = null;
}

function focoStatus(valor?: string) {
  const mapa: Record<string, string> = {
    monitorado: 'Monitorado',
    em_gestao: 'Em Gestão',
    mitigado: 'Mitigado'
  };
  return mapa[valor || ''] || '-';
}

function formatarData(data: string) {
  if (!data) return '';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

onMounted(async () => {
  await carregarFocos();
});
</script>

<style scoped>
.asa-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 8px;
}

.subtitle {
  color: #7f8c8d;
  font-size: 15px;
}

.content-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 20px;
  color: #2c3e50;
  margin-bottom: 4px;
}

.section-header p {
  color: #7f8c8d;
  font-size: 14px;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.data-table th {
  background: #f8f9fa;
  color: #2c3e50;
  font-weight: 600;
}

.data-table tbody tr:hover {
  background: #f8f9fa;
}

.text-right {
  text-align: right;
}

.empty-state {
  text-align: center;
  color: #95a5a6;
  padding: 40px !important;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.status-monitorado {
  background: #fff3cd;
  color: #856404;
}

.status-em_gestao {
  background: #cce5ff;
  color: #004085;
}

.status-mitigado {
  background: #d4edda;
  color: #155724;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
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

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  margin: 0 2px;
}

.btn-danger:hover {
  opacity: 0.7;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  font-size: 20px;
  color: #2c3e50;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 32px;
  color: #95a5a6;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.btn-close:hover {
  color: #7f8c8d;
}

.modal-form {
  padding: 24px;
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
  margin-bottom: 16px;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 6px;
  color: #2c3e50;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    gap: 16px;
  }

  .data-table {
    font-size: 12px;
  }

  .data-table th,
  .data-table td {
    padding: 8px;
  }
}
</style>
