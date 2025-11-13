<template>
  <div class="page">
    <form v-if="etapa === 'login'" class="card" @submit.prevent="entrar">
      <h3>Acessar</h3>
      <label>
        Usuário
        <input v-model="user" required />
      </label>
      <label>
        Senha
        <input v-model="pass" type="password" required />
      </label>
      <button class="btn btn-primary" type="submit" :disabled="carregando">
        {{ carregando ? 'Entrando...' : 'Entrar' }}
      </button>
      <p v-if="erro" class="erro">{{ erro }}</p>
    </form>

    <form v-else-if="etapa === 'escolha'" class="card" @submit.prevent="confirmarAeroporto">
      <h3>Selecionar aeroporto</h3>
      <label>
        Aeroporto
        <select v-model.number="selecionado" required>
          <option value="">Selecione</option>
          <option v-for="a in aeroportos" :key="a.id" :value="a.id">
            {{ a.icao_code }} - {{ a.name }}
          </option>
        </select>
      </label>
      <button class="btn btn-primary" type="submit" :disabled="carregando">
        {{ carregando ? 'Confirmando...' : 'Confirmar' }}
      </button>
      <button class="btn btn-secondary" type="button" @click="voltarLogin">Voltar</button>
      <p v-if="erro" class="erro">{{ erro }}</p>
    </form>

    <form v-else class="card" @submit.prevent="salvarNovaSenha">
      <h3>Definir nova senha</h3>
      <p class="info">Por segurança, defina uma nova senha antes de continuar.</p>
      <label>
        Nova senha
        <input v-model="novaSenha" type="password" required minlength="6" />
      </label>
      <label>
        Confirmar senha
        <input v-model="confirmarSenha" type="password" required minlength="6" />
      </label>
      <button class="btn btn-primary" type="submit" :disabled="carregando">
        {{ carregando ? 'Salvando...' : 'Salvar nova senha' }}
      </button>
      <button class="btn btn-secondary" type="button" @click="voltarLogin">Cancelar</button>
      <p v-if="erro" class="erro">{{ erro }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApiService } from '@/services/api';

type Etapa = 'login' | 'escolha' | 'troca';

const user = ref('');
const pass = ref('');
const novaSenha = ref('');
const confirmarSenha = ref('');
const carregando = ref(false);
const erro = ref<string | null>(null);
const aeroportos = ref<any[]>([]);
const selecionado = ref<string | number>('');
const etapa = ref<Etapa>('login');
const ultimoLogin = ref<any>(null);

async function entrar() {
  carregando.value = true;
  erro.value = null;
  try {
    const resp = await ApiService.login(user.value, pass.value);
    ultimoLogin.value = resp;
    if (resp?.usuario?.must_reset_password) {
      etapa.value = 'troca';
      return;
    }
    posLogin(resp);
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Falha no login';
  } finally {
    carregando.value = false;
  }
}

function posLogin(resp: any) {
  erro.value = null;
  const lista = resp?.aeroportos_permitidos ?? [];
  if (lista.length > 1) {
    aeroportos.value = lista;
    selecionado.value = lista[0]?.id ?? '';
    etapa.value = 'escolha';
  } else {
    window.location.href = '/';
  }
}

async function confirmarAeroporto() {
  if (!selecionado.value) return;
  carregando.value = true;
  erro.value = null;
  try {
    await ApiService.switchAirport(Number(selecionado.value));
    window.location.href = '/';
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Falha ao definir aeroporto';
  } finally {
    carregando.value = false;
  }
}

async function salvarNovaSenha() {
  erro.value = null;
  if (!novaSenha.value || novaSenha.value.length < 6) {
    erro.value = 'A nova senha deve ter ao menos 6 caracteres.';
    return;
  }
  if (novaSenha.value !== confirmarSenha.value) {
    erro.value = 'As senhas não conferem.';
    return;
  }
  carregando.value = true;
  try {
    await ApiService.changePassword({ current_password: pass.value, new_password: novaSenha.value });
    const stored = ApiService.getUser<any>();
    if (stored) {
      ApiService.setUser({ ...stored, must_reset_password: false });
    }
    novaSenha.value = '';
    confirmarSenha.value = '';
    if (ultimoLogin.value) {
      ultimoLogin.value.usuario.must_reset_password = false;
      posLogin(ultimoLogin.value);
    } else {
      etapa.value = 'login';
    }
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Não foi possível alterar a senha';
  } finally {
    carregando.value = false;
  }
}

function voltarLogin() {
  etapa.value = 'login';
  erro.value = null;
  carregando.value = false;
  aeroportos.value = [];
  selecionado.value = '';
  ultimoLogin.value = null;
  ApiService.clearToken();
  ApiService.clearUser();
}
</script>

<style scoped>
.page { display: flex; align-items: center; justify-content: center; height: 100vh; padding: 1rem; background: #f8fafc; }
.card { display: flex; flex-direction: column; gap: 0.75rem; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 10px; width: 320px; background: #fff; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.05); }
.erro { color: #b91c1c; font-size: .9rem; }
.info { font-size: .85rem; color: #475569; }
label { display:flex; flex-direction: column; gap: .25rem; font-size: .9rem; }
input, select { padding: .5rem .6rem; border: 1px solid #cbd5e1; border-radius: 8px; }
.btn { padding: .5rem .7rem; border: none; border-radius: 8px; cursor: pointer; }
.btn-primary { background: #0f172a; color: #fff; }
.btn-secondary { background: #94a3b8; color: #0f172a; }
</style>
