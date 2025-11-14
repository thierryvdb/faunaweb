<template>
  <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
    <div class="card">
      <h3>Aeroportos</h3>
      <form class="form" @submit.prevent="salvarAeroporto">
        <label>
          ICAO
          <input maxlength="4" v-model="novoAero.icao_code" required />
        </label>
        <label>
          Nome
          <input v-model="novoAero.name" required />
        </label>
        <label>
          Cidade
          <input v-model="novoAero.city" />
        </label>
        <button class="btn btn-primary" type="submit">Adicionar</button>
      </form>
      <ul>
        <li v-for="a in aeroportos" :key="a.id">{{ a.icao_code }} - {{ a.name }}</li>
      </ul>
    </div>
    <div class="card">
      <h3>Especies monitoradas</h3>
      <form class="form" @submit.prevent="salvarEspecie">
        <label>
          Nome comum
          <input v-model="novaEspecie.common_name" required />
        </label>
        <label>
          Grupo
          <select v-model.number="novaEspecie.group_id">
            <option v-for="g in lookups.grupos_taxonomicos" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Adicionar</button>
      </form>
      <ul>
        <li v-for="s in especies" :key="s.id">{{ s.common_name }}</li>
      </ul>
    </div>
    <div class="card">
      <h3>Locais operacionais</h3>
      <form class="form" @submit.prevent="salvarLocal">
        <label>
          Aeroporto
          <select v-model.number="localForm.airport_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>
          Código/Área
          <input v-model="localForm.code" required />
        </label>
        <label>
          Pista/Faixa (opcional)
          <input v-model="localForm.runway_ref" />
        </label>
        <label>
          Descrição
          <textarea rows="2" v-model="localForm.description"></textarea>
        </label>
        <button class="btn btn-primary" type="submit">Adicionar local</button>
      </form>
      <div v-if="locaisSelecionados.length" class="lista-locais">
        <article v-for="loc in locaisSelecionados" :key="loc.id" class="local-item">
          <div>
            <strong>{{ loc.code }}</strong>
            <span v-if="loc.runway_ref"> - {{ loc.runway_ref }}</span>
            <p>{{ loc.description }}</p>
          </div>
          <button class="btn btn-secondary" @click="removerLocal(loc.id)">Remover</button>
        </article>
      </div>
      <p v-else class="vazio">Selecione um aeroporto para listar os locais.</p>
    </div>
    <div class="card">
      <h3>Equipes de fauna</h3>
      <form class="form" @submit.prevent="salvarEquipe">
        <label>
          Aeroporto
          <select v-model.number="formEquipe.airport_id" required>
            <option value="" disabled>Selecione</option>
            <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <label>
          Nome da equipe
          <input v-model="formEquipe.name" required />
        </label>
        <label>
          Observações
          <textarea rows="2" v-model="formEquipe.description"></textarea>
        </label>
        <button class="btn btn-primary" type="submit">Salvar equipe</button>
      </form>
      <div v-if="equipesSelecionadas.length" class="lista-locais">
        <article v-for="team in equipesSelecionadas" :key="team.id" class="local-item">
          <div>
            <strong>{{ team.name }}</strong>
            <p>{{ team.description }}</p>
          </div>
          <button class="btn btn-secondary" @click="removerEquipe(team.id)">Remover</button>
        </article>
      </div>
      <p v-else class="vazio">Selecione um aeroporto para listar as equipes.</p>
    </div>
    <div class="card">
      <h3>Quadrantes operacionais</h3>
      <form class="form" @submit.prevent="salvarQuadrante">
        <label>
          Código
          <input v-model="formQuadrante.code" maxlength="16" required />
        </label>
        <label>
          Descrição
          <input v-model="formQuadrante.description" />
        </label>
        <div class="acoes-form">
          <button class="btn btn-primary" type="submit" :disabled="salvandoQuadrante">
            {{ salvandoQuadrante ? 'Salvando...' : formQuadrante.id ? 'Atualizar' : 'Adicionar' }}
          </button>
          <button v-if="formQuadrante.id" class="btn btn-secondary" type="button" @click="cancelarQuadrante">Cancelar</button>
        </div>
      </form>
      <div class="acoes-form">
        <button class="btn btn-secondary" type="button" :disabled="resetandoQuadrantes" @click="resetarQuadrantes">
          {{ resetandoQuadrantes ? 'Gerando grade...' : 'Gerar grade A-N x 1-33' }}
        </button>
        <small class="ajuda">Esta ação substitui todos os quadrantes atuais pela grade completa.</small>
      </div>
      <ul class="lista-quadrantes">
        <li v-for="q in quadrantes" :key="q.id">
          <div>
            <strong>{{ q.code }}</strong>
            <p>{{ q.description || 'Sem descri��o' }}</p>
          </div>
          <div class="acoes-quadrante">
            <button class="link" type="button" @click="editarQuadrante(q)">Editar</button>
            <button class="link" type="button" @click="removerQuadrante(q.id)">Remover</button>
          </div>
        </li>
        <li v-if="!quadrantes.length">Nenhum quadrante cadastrado.</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ApiService, api } from '@/services/api';

const aeroportos = ref<any[]>([]);
const especies = ref<any[]>([]);
const lookups = ref<any>({ grupos_taxonomicos: [] });
const quadrantes = ref<any[]>([]);

const novoAero = ref({ icao_code: '', name: '', city: '' });
const novaEspecie = ref({ common_name: '', group_id: undefined as any });
const localForm = ref({ airport_id: '' as any, code: '', runway_ref: '', description: '' });
const locaisSelecionados = ref<any[]>([]);
const formEquipe = ref({ airport_id: '' as any, name: '', description: '' });
const equipesSelecionadas = ref<any[]>([]);
const formQuadrante = ref<{ id: number | null; code: string; description: string }>({ id: null, code: '', description: '' });
const salvandoQuadrante = ref(false);
const resetandoQuadrantes = ref(false);

async function carregar() {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos;
  especies.value = cad.especies;
  lookups.value = cad.lookups;
  quadrantes.value = cad.quadrantes ?? [];
  if (!novaEspecie.value.group_id && lookups.value.grupos_taxonomicos?.length) {
    novaEspecie.value.group_id = lookups.value.grupos_taxonomicos[0].id;
  }
}

async function salvarAeroporto() {
  await api.post('/api/aeroportos', { ...novoAero.value });
  novoAero.value = { icao_code: '', name: '', city: '' };
  carregar();
}

async function salvarEspecie() {
  await api.post('/api/especies', { ...novaEspecie.value });
  novaEspecie.value = { common_name: '', group_id: lookups.value.grupos_taxonomicos?.[0]?.id };
  carregar();
}

async function carregarLocaisDoAeroporto(id?: number) {
  if (!id) {
    locaisSelecionados.value = [];
    return;
  }
  locaisSelecionados.value = await ApiService.getLocaisPorAeroporto(id);
}

async function salvarLocal() {
  if (!localForm.value.airport_id) return;
  await ApiService.criarLocal(localForm.value.airport_id, {
    code: localForm.value.code,
    runway_ref: localForm.value.runway_ref || undefined,
    description: localForm.value.description || undefined
  });
  await carregarLocaisDoAeroporto(localForm.value.airport_id);
  localForm.value = { ...localForm.value, code: '', runway_ref: '', description: '' };
}

async function removerLocal(locationId: number) {
  if (!localForm.value.airport_id) return;
  await ApiService.removerLocal(localForm.value.airport_id, locationId);
  await carregarLocaisDoAeroporto(localForm.value.airport_id);
}

async function carregarEquipesDoAeroporto(id?: number) {
  if (!id) {
    equipesSelecionadas.value = [];
    return;
  }
  equipesSelecionadas.value = await ApiService.getEquipesPorAeroporto(id);
}

async function salvarEquipe() {
  if (!formEquipe.value.airport_id) return;
  await api.post(`/api/aeroportos/${formEquipe.value.airport_id}/equipes`, {
    name: formEquipe.value.name,
    description: formEquipe.value.description || undefined
  });
  await carregarEquipesDoAeroporto(formEquipe.value.airport_id);
  formEquipe.value = { ...formEquipe.value, name: '', description: '' };
}

async function removerEquipe(teamId: number) {
  if (!formEquipe.value.airport_id) return;
  await api.delete(`/api/aeroportos/${formEquipe.value.airport_id}/equipes/${teamId}`);
  await carregarEquipesDoAeroporto(formEquipe.value.airport_id);
}

async function resetarQuadrantes() {
  if (!confirm('Isto irá substituir todos os quadrantes cadastrados pela grade completa A-N x 1-33. Deseja continuar?')) {
    return;
  }
  resetandoQuadrantes.value = true;
  try {
    await ApiService.resetQuadrantes();
    await carregarQuadrantes();
  } catch (error: any) {
    const mensagem = error?.response?.data?.mensagem ?? 'Falha ao gerar a grade';
    alert(mensagem);
  } finally {
    resetandoQuadrantes.value = false;
  }
}

async function carregarQuadrantes() {
  quadrantes.value = await ApiService.getQuadrantes();
}

function editarQuadrante(q: any) {
  formQuadrante.value = {
    id: q.id,
    code: q.code,
    description: q.description || ''
  };
}

function cancelarQuadrante() {
  formQuadrante.value = { id: null, code: '', description: '' };
}

async function salvarQuadrante() {
  if (!formQuadrante.value.code.trim()) {
    return;
  }
  salvandoQuadrante.value = true;
  try {
    const payload = {
      code: formQuadrante.value.code.trim(),
      description: formQuadrante.value.description.trim() || undefined
    };
    if (formQuadrante.value.id) {
      await ApiService.atualizarQuadrante(formQuadrante.value.id, payload);
    } else {
      await ApiService.criarQuadrante(payload);
    }
    cancelarQuadrante();
    await carregarQuadrantes();
  } catch (error: any) {
    const mensagem = error?.response?.data?.mensagem ?? 'Falha ao salvar quadrante';
    alert(mensagem);
  } finally {
    salvandoQuadrante.value = false;
  }
}

async function removerQuadrante(id: number) {
  if (!confirm('Remover este quadrante?')) {
    return;
  }
  await ApiService.removerQuadrante(id);
  if (formQuadrante.value.id === id) {
    cancelarQuadrante();
  }
  await carregarQuadrantes();
}

watch(
  () => formEquipe.value.airport_id,
  (novo) => {
    carregarEquipesDoAeroporto(novo);
  }
);

watch(
  () => localForm.value.airport_id,
  (novo) => {
    carregarLocaisDoAeroporto(novo);
  }
);

onMounted(carregar);
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

input,
select,
textarea {
  padding: 0.45rem 0.5rem;
  border: 1px solid #cbd5f5;
  border-radius: 8px;
}

.lista-locais {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.local-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
}

.local-item p {
  margin: 0.25rem 0 0;
  color: #475569;
}

.vazio {
  color: #94a3b8;
}

ul {
  list-style: none;
  padding-left: 0;
  max-height: 200px;
  overflow-y: auto;
}

li {
  padding: 0.3rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.lista-quadrantes {
  list-style: none;
  padding-left: 0;
  max-height: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lista-quadrantes li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.6rem;
}

.lista-quadrantes li p {
  margin: 0.2rem 0 0;
  color: #475569;
}

.acoes-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ajuda {
  font-size: 0.8rem;
  color: #64748b;
}

.acoes-quadrante {
  display: flex;
  gap: 0.5rem;
}

button.link {
  background: none;
  border: none;
  color: #0ea5e9;
  padding: 0;
  cursor: pointer;
}

button.link:hover {
  text-decoration: underline;
}
</style>
