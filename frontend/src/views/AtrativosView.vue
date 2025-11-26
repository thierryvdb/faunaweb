<template>
  <div class="grid" style="grid-template-columns: 2fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
    <div class="card">
      <header class="cabecalho">
        <h3>Gestão de Atrativos</h3>
        <button class="btn btn-secondary" @click="carregar">Atualizar</button>
      </header>
      <div class="filtros">
        <label>
          Categoria de Ação
          <select v-model="filtros.action_category">
            <option value="">Todas</option>
            <option value="ativa">Ação Ativa (Afugentamento)</option>
            <option value="passiva">Ação Passiva (Prevenção)</option>
          </select>
        </label>
        <button class="btn btn-primary" @click="carregar">Filtrar</button>
      </div>
      <LoadingState :carregando="carregando" :erro="erro">
        <DataTable :colunas="colunas" :dados="lista" vazio="Sem atrativos">
          <template #date_br="{ valor }">{{ valor ?? '-' }}</template>
          <template #tipo_nome="{ valor }">{{ valor ?? '-' }}</template>
          <template #acao_categoria="{ linha }">
            <span v-if="linha.action_category === 'ativa'" class="badge badge-ativa">Ação Ativa</span>
            <span v-else-if="linha.action_category === 'passiva'" class="badge badge-passiva">Ação Passiva</span>
            <span v-else class="badge badge-sem-acao">Sem ação definida</span>
          </template>
          <template #acoes="{ linha }">
            <button v-if="canUpdate" class="btn btn-secondary" @click="editar(linha)">Editar</button>
            <span v-else class="text-muted">-</span>
          </template>
        </DataTable>
      </LoadingState>
    </div>
    <div v-if="canCreate || canUpdate" class="card">
      <header class="cabecalho">
        <h3>{{ editandoId ? 'Editar atrativo' : 'Novo registro' }}</h3>
        <button v-if="editandoId" class="btn btn-secondary" type="button" @click="cancelarEdicao">Cancelar</button>
      </header>
      <form class="form" @submit.prevent="salvar">
        <label>
          Aeroporto *
          <select v-model.number="novo.airport_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>
          Data *
          <input type="date" lang="pt-BR" v-model="novo.date_utc" required />
        </label>
        <label>
          Tipo de Atrativo
          <select v-model.number="novo.attractor_type_id">
            <option :value="undefined">Selecione</option>
            <option v-for="t in lookups.tipos_atrativo" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </label>
        <label>
          Descrição
          <textarea v-model="novo.description" rows="3" placeholder="Descreva o atrativo identificado"></textarea>
        </label>

        <!-- Nova seção: Categoria de Ação -->
        <div class="form-section">
          <h4>Ação de Mitigação</h4>
          <p class="help-text">
            <strong>Ações Ativas:</strong> Afugentamento imediato (captura, pirotecnia, laser, etc.)<br>
            <strong>Ações Passivas:</strong> Prevenção e modificação de ambiente (monitoramento, controle de habitat, etc.)
          </p>

          <label>
            Categoria de Ação
            <select v-model="novo.action_category" @change="onCategoriaChange">
              <option value="">Nenhuma ação ainda</option>
              <option value="ativa">Ação Ativa (Afugentamento imediato)</option>
              <option value="passiva">Ação Passiva (Prevenção/Modificação)</option>
            </select>
          </label>

          <label v-if="novo.action_category">
            Tipo de Ação *
            <select v-model.number="novo.mitigation_action_type_id" :required="!!novo.action_category">
              <option value="">Selecione o tipo específico</option>
              <optgroup v-if="novo.action_category === 'ativa'" label="Ações Ativas">
                <option v-for="t in acoesAtivas" :key="t.id" :value="t.id">{{ t.name }}</option>
              </optgroup>
              <optgroup v-if="novo.action_category === 'passiva'" label="Ações Passivas">
                <option v-for="t in acoesPassivas" :key="t.id" :value="t.id">{{ t.name }}</option>
              </optgroup>
            </select>
          </label>
        </div>

        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import DataTable from '@/components/DataTable.vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService, api } from '@/services/api';
import { usePermissions } from '@/composables/usePermissions';

const { canCreate, canUpdate, canDelete } = usePermissions();

const colunas = computed(() => {
  const baseCols = [
    { titulo: 'Data', campo: 'date_br' },
    { titulo: 'Tipo', campo: 'tipo_nome' },
    { titulo: 'Categoria de Ação', campo: 'acao_categoria' },
    { titulo: 'Ação Aplicada', campo: 'mitigation_action_name' },
    { titulo: 'Descrição', campo: 'description' }
  ];
  if (canUpdate.value) {
    baseCols.push({ titulo: 'Ações', campo: 'acoes' });
  }
  return baseCols;
});

const filtros = ref<{ action_category?: string }>({});
const lista = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const lookups = ref<any>({ tipos_atrativo: [], tipos_acao_mitigacao: [] });
const carregando = ref(false);
const erro = ref<string | null>(null);
const novo = ref({
  airport_id: '' as any,
  date_utc: '',
  attractor_type_id: undefined as any,
  action_category: '',
  mitigation_action_type_id: undefined as any,
  description: ''
});
const editandoId = ref<number | null>(null);

// Computed properties para filtrar ações por categoria
const acoesAtivas = computed(() => {
  return lookups.value.tipos_acao_mitigacao?.filter((a: any) => a.category === 'ativa') || [];
});

const acoesPassivas = computed(() => {
  return lookups.value.tipos_acao_mitigacao?.filter((a: any) => a.category === 'passiva') || [];
});

function onCategoriaChange() {
  // Limpa o tipo de ação quando muda a categoria
  novo.value.mitigation_action_type_id = undefined as any;
}

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const dados = await ApiService.getAtrativos(filtros.value);
    lista.value = dados.map((atr: any) => ({
      ...atr,
      date_br: atr.date_utc ? new Date(atr.date_utc).toLocaleDateString('pt-BR') : null,
      tipo_nome: lookups.value.tipos_atrativo.find((t: any) => t.id === atr.attractor_type_id)?.name ?? '-'
    }));
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar atrativos';
  } finally {
    carregando.value = false;
  }
}

async function salvar() {
  try {
    if (editandoId.value) {
      await api.put(`/atrativos/${editandoId.value}`, novo.value);
    } else {
      await api.post('/atrativos', novo.value);
    }
    await carregar();
    cancelarEdicao();
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao salvar');
  }
}

function cancelarEdicao() {
  editandoId.value = null;
  novo.value = {
    airport_id: '' as any,
    date_utc: '',
    attractor_type_id: undefined as any,
    action_category: '',
    mitigation_action_type_id: undefined as any,
    description: ''
  };
}

function editar(atr: any) {
  editandoId.value = atr.id;
  novo.value = {
    airport_id: atr.airport_id,
    date_utc: atr.date_utc ? atr.date_utc.slice(0, 10) : '',
    attractor_type_id: atr.attractor_type_id,
    action_category: atr.action_category || '',
    mitigation_action_type_id: atr.mitigation_action_type_id,
    description: atr.description ?? ''
  } as any;
}

watch(
  () => novo.value.airport_id,
  async () => {
    if (novo.value.airport_id) {
      try {
        const user = ApiService.getUser<any>();
        if (user?.aeroporto_id && user.aeroporto_id !== novo.value.airport_id) {
          await ApiService.switchAirport(Number(novo.value.airport_id));
        }
      } catch {}
    }
  }
);

onMounted(async () => {
  try {
    const cad = await ApiService.getCadastros();
    aeroportos.value = cad.aeroportos ?? [];
    lookups.value = cad.lookups ?? { tipos_atrativo: [], tipos_acao_mitigacao: [] };
    const user = ApiService.getUser<any>();
    if (user?.aeroporto_id) {
      novo.value.airport_id = user.aeroporto_id;
    }
    await carregar();
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao carregar dados';
  }
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
  flex-direction: column;
  gap: 0.75rem;
}

.form-section {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  margin: 10px 0;
}

.form-section h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  font-size: 16px;
}

.help-text {
  font-size: 13px;
  color: #666;
  margin-bottom: 15px;
  line-height: 1.6;
}

select,
input,
textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.badge-ativa {
  background: #ffebee;
  color: #c62828;
}

.badge-passiva {
  background: #e3f2fd;
  color: #1565c0;
}

.badge-sem-acao {
  background: #f5f5f5;
  color: #757575;
}
</style>
