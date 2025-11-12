<template>
  <RouterView v-if="isLogin" />
  <div v-else class="layout">
    <aside class="menu">
      <div class="logo">Fauna Safety</div>
      <nav>
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="menu-link" active-class="ativo">
          {{ link.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="conteudo">
      <header class="topo">
        <h1>{{ tituloPagina }}</h1>
        <div class="acoes-topo">Olá, {{ usuario?.nome }} — {{ usuario?.aeroporto || '' }} <button class="btn btn-secondary" @click="sair">Sair</button></div>
        <p>Monitoramento integrado de fauna, riscos e KPIs aeroportuários.</p>
      </header>
      <section class="miolo">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { ApiService } from '@/services/api';

const links = [
  { to: '/', label: 'Painel' },
  { to: '/movimentos', label: 'Movimentos' },
  { to: '/avistamentos', label: 'Avistamentos' },
  { to: '/colisoes', label: 'Colisões' },
  { to: '/acoes', label: 'Ações de Controle' },
  { to: '/atrativos', label: 'Atrativos' },
  { to: '/cadastros', label: 'Cadastros' }
];

const route = useRoute();
const isLogin = computed(() => route.path === '/login');
const titulos: Record<string, string> = {
  '/': 'Visão geral',
  '/movimentos': 'Movimentos operacionais',
  '/avistamentos': 'Avistamentos de fauna',
  '/colisoes': 'Colisões com fauna',
  '/acoes': 'Ações de controle',
  '/atrativos': 'Gestão de atrativos',
  '/cadastros': 'Cadastros de apoio'
};

const tituloPagina = computed(() => titulos[route.path] ?? 'Painel');

function sair() {
  ApiService.clearToken();
  ApiService.clearUser();
  window.location.href = '/login';
}

type Usuario = { id: number; nome: string; aeroporto?: string; aeroporto_id?: number };
const usuario = computed(() => ApiService.getUser<Usuario>());
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.menu { width: 240px; background: #0f172a; color: #fff; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 2rem; }
.logo { font-size: 1.4rem; font-weight: 700; }
.menu-link { display: block; color: #cbd5f5; text-decoration: none; margin-bottom: 0.75rem; font-weight: 600; }
.menu-link.ativo { color: #38bdf8; }
.conteudo { flex: 1; padding: 2rem; }
.topo { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; }
.acoes-topo { margin-left: auto; }
.miolo { display: flex; flex-direction: column; gap: 1.5rem; }
@media (max-width: 960px) {
  .layout { flex-direction: column; }
  .menu { width: 100%; flex-direction: row; flex-wrap: wrap; gap: 1rem; }
  .menu-link { margin: 0 1rem 0 0; }
}
</style>