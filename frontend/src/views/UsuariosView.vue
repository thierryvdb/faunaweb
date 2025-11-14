<template>
  <div class="painel">
    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>Usuários cadastrados</h2>
          <p>Gerencie acessos e aeroportos permitidos para cada usuário.</p>
        </div>
        <div class="acoes-topo">
          <button class="btn btn-secondary" :disabled="!selecionados.length" @click="resetSelecionados">
            Redefinir senha selecionados
          </button>
          <button class="btn" @click="novo">Novo usuário</button>
        </div>
      </header>
      <div class="tabela">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" :checked="todosMarcados" @change="toggleTodos($event)" />
              </th>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Principal</th>
              <th>Aeroportos</th>
              <th>Status</th>
              <th>Senha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in usuarios" :key="u.user_id">
              <td>
                <input type="checkbox" :value="u.user_id" v-model="selecionados" />
              </td>
              <td>{{ u.name }}</td>
              <td>{{ u.username }}</td>
              <td>{{ nomeAeroporto(u.primary_airport_id) }}</td>
              <td>
                <span v-for="a in u.aeroportos" :key="a.id" class="badge">{{ a.icao }} - {{ a.name }}</span>
              </td>
              <td>
                <span :class="['status', u.active ? 'ativo' : 'inativo']">
                  {{ u.active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td>
                <span v-if="u.must_reset_password" class="aviso">Troca pendente</span>
                <button class="btn btn-secondary btn-xs" @click="resetSenha(u)">Redefinir</button>
              </td>
              <td class="acoes">
                <button class="btn btn-secondary btn-xs" @click="editar(u)">Editar</button>
                <button class="btn btn-danger btn-xs" @click="remover(u)">Excluir</button>
              </td>
            </tr>
            <tr v-if="!usuarios.length">
              <td colspan="8">Nenhum usuário cadastrado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="bloco">
      <header class="bloco-topo">
        <div>
          <h2>{{ editandoId ? 'Editar usuário' : 'Novo usuário' }}</h2>
          <p>Defina nome, login, aeroporto principal e todos os aeroportos liberados.</p>
        </div>
      </header>
      <form class="form" @submit.prevent="salvar">
        <div class="grid">
          <label>
            Nome*
            <input v-model="form.name" required />
          </label>
          <label>
            Usuário*
            <input v-model="form.username" required />
          </label>
          <label>
            Aeroporto principal*
            <select v-model.number="form.primary_airport_id" required>
              <option value="">Selecione</option>
              <option v-for="a in aeroportos" :key="a.id" :value="a.id">{{ a.icao_code }} - {{ a.name }}</option>
            </select>
          </label>
          <label class="toggle">
            <input type="checkbox" v-model="form.active" />
            Ativo
          </label>
        </div>
        <div class="checkboxes">
          <p>Aeroportos liberados*</p>
          <div class="lista">
            <label v-for="a in aeroportos" :key="`sel-${a.id}`">
              <input type="checkbox" :value="a.id" v-model="form.airport_ids" />
              {{ a.icao_code }} - {{ a.name }}
            </label>
          </div>
        </div>
        <div class="acoes-form">
          <button class="btn principal" type="submit" :disabled="salvando || !podeSalvar">
            {{ salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Criar usuário' }}
          </button>
          <button v-if="editandoId" class="btn btn-secondary" type="button" @click="novo">Cancelar edição</button>
        </div>
        <p class="info">
          Senha padrão para novos usuários: <code>fauna1</code>. Ao primeiro login será solicitada a troca.
        </p>
        <p v-if="erro" class="erro">{{ erro }}</p>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ApiService } from '@/services/api';

const usuarios = ref<any[]>([]);
const aeroportos = ref<any[]>([]);
const selecionados = ref<number[]>([]);
const editandoId = ref<number | null>(null);
const salvando = ref(false);
const erro = ref<string | null>(null);

const form = reactive({
  name: '',
  username: '',
  primary_airport_id: '' as number | '',
  airport_ids: [] as number[],
  active: true
});

const podeSalvar = computed(() => {
  return (
    form.name.trim().length > 1 &&
    form.username.trim().length > 1 &&
    !!form.primary_airport_id &&
    form.airport_ids.length > 0 &&
    form.airport_ids.includes(Number(form.primary_airport_id))
  );
});

const todosMarcados = computed(() => {
  return usuarios.value.length > 0 && selecionados.value.length === usuarios.value.length;
});

function nomeAeroporto(id: number) {
  const a = aeroportos.value.find((item: any) => item.id === id);
  return a ? `${a.icao_code}` : '-';
}

function prepararForm(u?: any) {
  if (!u) {
    form.name = '';
    form.username = '';
    form.primary_airport_id = '' as any;
    form.airport_ids = [];
    form.active = true;
    editandoId.value = null;
    return;
  }
  form.name = u.name;
  form.username = u.username;
  form.primary_airport_id = u.primary_airport_id;
  form.airport_ids = (u.aeroportos ?? []).map((a: any) => a.id);
  if (!form.airport_ids.includes(u.primary_airport_id)) {
    form.airport_ids.push(u.primary_airport_id);
  }
  form.active = u.active;
  editandoId.value = u.user_id;
}

async function carregarUsuarios() {
  usuarios.value = await ApiService.getUsuarios();
  const ids = new Set(usuarios.value.map((u: any) => u.user_id));
  selecionados.value = selecionados.value.filter((id) => ids.has(id));
}

async function carregarAeroportos() {
  const cad = await ApiService.getCadastros();
  aeroportos.value = cad.aeroportos ?? [];
}

async function salvar() {
  if (!podeSalvar.value) return;
  salvando.value = true;
  erro.value = null;
  try {
    const payload = {
      name: form.name,
      username: form.username,
      primary_airport_id: Number(form.primary_airport_id),
      airport_ids: form.airport_ids,
      active: form.active
    };
    if (editandoId.value) {
      await ApiService.atualizarUsuario(editandoId.value, payload);
    } else {
      await ApiService.criarUsuario(payload);
    }
    await carregarUsuarios();
    novo();
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Falha ao salvar usuário';
  } finally {
    salvando.value = false;
  }
}

function novo() {
  prepararForm();
}

function editar(u: any) {
  prepararForm(u);
}

async function resetSenha(u: any) {
  if (!confirm(`Redefinir a senha do usuário ${u.name}?`)) return;
  await ApiService.resetSenhaUsuario(u.user_id);
  await carregarUsuarios();
}

async function resetSelecionados() {
  if (!selecionados.value.length) return;
  if (!confirm(`Redefinir a senha de ${selecionados.value.length} usuário(s)?`)) return;
  await ApiService.resetSenhaUsuarioLote(selecionados.value);
  selecionados.value = [];
  await carregarUsuarios();
}

async function remover(u: any) {
  if (!confirm(`Excluir o usuário ${u.name}?`)) return;
  await ApiService.removerUsuario(u.user_id);
  if (editandoId.value === u.user_id) {
    novo();
  }
  await carregarUsuarios();
  selecionados.value = selecionados.value.filter((id) => id !== u.user_id);
}

function toggleTodos(event: Event) {
  const marcado = (event.target as HTMLInputElement).checked;
  selecionados.value = marcado ? usuarios.value.map((u: any) => u.user_id) : [];
}

onMounted(async () => {
  await Promise.all([carregarAeroportos(), carregarUsuarios()]);
});

watch(
  () => form.primary_airport_id,
  (novo) => {
    if (!novo) return;
    const id = Number(novo);
    if (!form.airport_ids.includes(id)) {
      form.airport_ids = [...form.airport_ids, id];
    }
  }
);
</script>

<style scoped>
.painel { display: flex; flex-direction: column; gap: 2rem; }
.bloco { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.bloco-topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
.acoes-topo { display: flex; gap: .75rem; flex-wrap: wrap; }
.btn { padding: .55rem 1.1rem; border: none; border-radius: 8px; background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-text); cursor: pointer; }
.btn.btn-secondary { background: var(--color-btn-secondary-bg); color: var(--color-btn-secondary-text); }
.btn.btn-danger { background: #dc2626; color: #fff; }
.btn-xs { font-size: .8rem; padding: .3rem .6rem; margin-right: .25rem; }
.btn.principal { background: var(--color-primary); color: #fff; }
.tabela table { width: 100%; border-collapse: collapse; font-size: .9rem; color: var(--color-text-primary); }
.tabela th, .tabela td { border-bottom: 1px solid var(--color-border); padding: .6rem; vertical-align: top; }
.tabela th { background: var(--color-bg-secondary); text-align: left; color: var(--color-text-primary); }
.badge { display: inline-block; background: var(--color-primary); color: #fff; padding: .2rem .4rem; border-radius: 999px; font-size: .75rem; margin-right: .25rem; margin-bottom: .25rem; opacity: 0.8; }
.status { padding: .15rem .45rem; border-radius: 999px; font-size: .75rem; }
.status.ativo { background: #dcfce7; color: #166534; }
.status.inativo { background: #fee2e2; color: #991b1b; }
.aviso { color: #b45309; font-size: .8rem; margin-right: .4rem; display: inline-block; }
.acoes { white-space: nowrap; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
label { display: flex; flex-direction: column; font-size: .9rem; gap: .35rem; color: var(--color-text-primary); }
input, select, textarea { padding: .5rem .55rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: .95rem; background: var(--color-bg-card); color: var(--color-text-primary); }
.checkboxes .lista { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .35rem; }
.checkboxes label { flex-direction: row; align-items: center; gap: .4rem; }
.toggle { flex-direction: row; align-items: center; gap: .4rem; margin-top: 1.8rem; }
.acoes-form { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
.info { font-size: .85rem; color: var(--color-text-secondary); }
.erro { color: #b91c1c; }
</style>
