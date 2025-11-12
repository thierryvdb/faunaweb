<template>
  <div class="page">
    <form class="card" @submit.prevent="entrar">
      <h3>Acessar</h3>
      <label>
        Usuário
        <input v-model="user" required />
      </label>
      <label>
        Senha
        <input v-model="pass" type="password" required />
      </label>
      <button class="btn btn-primary" type="submit" :disabled="carregando">{{ carregando ? 'Entrando...' : 'Entrar' }}</button>
      <p v-if="erro" class="erro">{{ erro }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApiService } from '@/services/api';

const user = ref('');
const pass = ref('');
const carregando = ref(false);
const erro = ref<string | null>(null);

async function entrar() {
  carregando.value = true;
  erro.value = null;
  try {
    await ApiService.login(user.value, pass.value);
    window.location.href = '/';
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Falha no login';
  } finally {
    carregando.value = false;
  }
}
</script>

<style scoped>
.page { display: flex; align-items: center; justify-content: center; height: 100vh; }
.card { display: flex; flex-direction: column; gap: 0.75rem; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 10px; width: 320px; }
.erro { color: #b91c1c; font-size: .9rem; }
label { display:flex; flex-direction: column; gap: .25rem; font-size: .9rem; }
input { padding: .5rem .6rem; border: 1px solid #cbd5e1; border-radius: 8px; }
</style>
