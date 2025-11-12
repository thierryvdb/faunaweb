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
          Pista/FAixa (opcional)
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ApiService, api } from '@/services/api';

const aeroportos = ref<any[]>([]);
const especies = ref<any[]>([]);
const lookups = ref<any>({ grupos_taxonomicos: [] });

const novoAero = ref({ icao_code: '', name: '', city: '' });
const novaEspecie = ref({ common_name: '', group_id: undefined as any });
const localForm = ref({ airport_id: '' as any, code: '', runway_ref: '', description: '' });
const locaisSelecionados = ref<any[]>([]);
const formEquipe = ref({ airport_id: '' as any, name: '', description: '' });
const equipesSelecionadas = ref<any[]>([]);

async function carregar() {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos;
  especies.value = cad.especies;
  lookups.value = cad.lookups;
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
</style>
