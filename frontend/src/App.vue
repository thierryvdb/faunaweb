<template>
  <div class="layout">
    <aside class="menu">
      <div class="logo">Fauna Safety</div>
      <nav>
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="menu-link"
          active-class="ativo"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="conteudo">
      <header class="topo">
        <h1>{{ tituloPagina }}</h1>
        <p>Monitoramento integrado de fauna, riscos e KPIs aeroportuarios.</p>
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

const links = [
  { to: '/', label: 'Painel' },
  { to: '/movimentos', label: 'Movimentos' },
  { to: '/avistamentos', label: 'Avistamentos' },
  { to: '/colisoes', label: 'Colisoes' },
  { to: '/acoes', label: 'Acoes de Controle' },
  { to: '/atrativos', label: 'Atrativos' },
  { to: '/cadastros', label: 'Cadastros' }
];

const route = useRoute();
const titulos: Record<string, string> = {
  '/': 'Visao geral',
  '/movimentos': 'Movimentos operacionais',
  '/avistamentos': 'Avistamentos de fauna',
  '/colisoes': 'Colisoes com fauna',
  '/acoes': 'Acoes de controle',
  '/atrativos': 'Gestao de atrativos',
  '/cadastros': 'Cadastros de apoio'
};

const tituloPagina = computed(() => titulos[route.path] ?? 'Painel');
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.menu {
  width: 240px;
  background: #0f172a;
  color: #fff;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.logo {
  font-size: 1.4rem;
  font-weight: 700;
}

.menu-link {
  display: block;
  color: #cbd5f5;
  text-decoration: none;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.menu-link.ativo {
  color: #38bdf8;
}

.conteudo {
  flex: 1;
  padding: 2rem;
}

.topo {
  margin-bottom: 1.5rem;
}

.miolo {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (max-width: 960px) {
  .layout {
    flex-direction: column;
  }
  .menu {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .menu-link {
    margin: 0 1rem 0 0;
  }
}
</style>
