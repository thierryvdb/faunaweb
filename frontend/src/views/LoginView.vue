<template>
  <div class="page">
    <form class="card" @submit.prevent="entrar">
      <h3>Acessar</h3>
      <label>
        Usu?rio
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
const aeroportos = ref<any[]>([]);
const selecionado = ref<string | number>('');
const etapa = ref<'login' | 'escolha'>('login');

async function entrar() {
  carregando.value = true;
  erro.value = null;
  try {
    const resp = await ApiService.login(user.value, pass.value);
    const lista = resp?.aeroportos_permitidos ?? [];
    if (lista.length > 1) {
      aeroportos.value = lista;
      selecionado.value = lista[0]?.id ?? '';
      etapa.value = 'escolha';
      return;
    }
    window.location.href = '/';
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Falha no login';
  } finally {
    carregando.value = false;
  }
}

async function confirmarAeroporto() {
  if (!selecionado.value) return;
  carregando.value = true;
  try {
    await ApiService.switchAirport(Number(selecionado.value));
    window.location.href = '/';
  } catch (e: any) {
    erro.value = e?.response?.data?.mensagem || 'Falha ao definir aeroporto';
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

