<template>
  <RouterView v-if="isLogin" />
  <div v-else class="layout">
    <!-- Menu lateral/superior -->
    <aside class="menu" :class="{ 'menu-aberto': menuAberto }">
      <div class="menu-header">
        <div class="logo">Fauna Safety</div>
        <button class="btn-menu-close" @click="toggleMenu">✕</button>
      </div>
      <nav>
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="menu-link"
          active-class="ativo"
          @click="fecharMenuMobile"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Overlay para fechar menu em mobile -->
    <div v-if="menuAberto" class="menu-overlay" @click="toggleMenu"></div>

    <main class="conteudo">
      <header class="topo">
        <div class="topo-linha1">
          <button class="btn-menu-mobile" @click="toggleMenu">☰</button>
          <h1>{{ tituloPagina }}</h1>
        </div>

        <div class="acoes-topo">
          <button
            class="btn-theme"
            @click="toggleDarkMode"
            :title="isDark ? 'Modo claro' : 'Modo escuro'"
          >
            {{ isDark ? '☀️' : '🌙' }}
          </button>

          <label class="sel-aero">
            <span class="sel-aero-label">Aeroporto</span>
            <select v-model.number="selAero" @change="trocarAeroporto">
              <option v-for="a in permitidos" :key="a.id" :value="a.id">
                {{ a.icao_code }} - {{ a.name }}
              </option>
            </select>
          </label>

          <div class="usuario-info">
            <span class="usuario-nome">{{ usuario?.nome }}</span>
            <span class="usuario-aero">{{ usuario?.aeroporto || '' }}</span>
          </div>

          <button class="btn btn-secondary" @click="sair">Sair</button>
        </div>

        <p class="topo-descricao">Monitoramento integrado de fauna, riscos e KPIs aeroportuários.</p>
      </header>

      <section class="miolo">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { ApiService } from '@/services/api';
import { useDarkMode } from '@/composables/useDarkMode';

const links = [
  { to: '/', label: 'Painel' },
  { to: '/movimentos', label: 'Movimentos' },
  { to: '/avistamentos', label: 'Avistamentos' },
  { to: '/colisoes', label: 'Colisões' },
  { to: '/acoes', label: 'Ações de Controle' },
  { to: '/atrativos', label: 'Atrativos' },
  { to: '/inspecoes', label: 'Inspeções/ASA' },
  { to: '/governanca', label: 'Governança' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/usuarios', label: 'Usuários' },
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
  '/inspecoes': 'Inspeções, ASA e carcaças',
  '/governanca': 'Governança e indicadores',
  '/relatorios': 'Relatórios e análises',
  '/relatorios/colisoes-imagens': 'Relatório de colisões com imagens',
  '/usuarios': 'Gestão de usuários',
  '/cadastros': 'Cadastros de apoio'
};

const tituloPagina = computed(() => titulos[route.path] ?? 'Painel');

// Dark mode
const { isDark, toggle: toggleDarkMode } = useDarkMode();

// Menu mobile
const menuAberto = ref(false);
const toggleMenu = () => {
  menuAberto.value = !menuAberto.value;
};
const fecharMenuMobile = () => {
  if (window.innerWidth <= 960) {
    menuAberto.value = false;
  }
};

function sair() {
  ApiService.clearToken();
  ApiService.clearUser();
  window.location.href = '/login';
}

type Usuario = { id: number; nome: string; aeroporto?: string; aeroporto_id?: number; aeroportos_permitidos?: any[] };
const usuario = computed(() => ApiService.getUser<Usuario>());
const permitidos = computed(
  () => (ApiService.getUser<any>()?.aeroportos_permitidos ?? []) as Array<{ id: number; icao_code: string; name: string }>
);
const selAero = ref<number | ''>(usuario.value?.aeroporto_id ?? '');

watch(usuario, () => {
  selAero.value = usuario.value?.aeroporto_id ?? '';
});

async function trocarAeroporto() {
  if (!selAero.value || selAero.value === usuario.value?.aeroporto_id) return;
  await ApiService.switchAirport(Number(selAero.value));
  window.location.reload();
}
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  position: relative;
}

/* Menu lateral */
.menu {
  width: 240px;
  background: var(--color-menu-bg);
  color: #fff;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  box-shadow: var(--shadow-menu);
  transition: transform 0.3s ease;
  position: relative;
  z-index: 1000;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.4rem;
  font-weight: 700;
}

.btn-menu-close {
  display: none;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

.menu-link {
  display: block;
  color: var(--color-menu-text);
  text-decoration: none;
  margin-bottom: 0.75rem;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.menu-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-link.ativo {
  color: var(--color-menu-active);
  background: rgba(56, 189, 248, 0.15);
}

/* Conteúdo principal */
.conteudo {
  flex: 1;
  padding: 2rem;
  min-width: 0;
}

/* Topo */
.topo {
  margin-bottom: 1.5rem;
}

.topo-linha1 {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.btn-menu-mobile {
  display: none;
  background: var(--color-btn-secondary-bg);
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  color: var(--color-text-primary);
}

.acoes-topo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.btn-theme {
  background: var(--color-btn-secondary-bg);
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: var(--color-text-primary);
}

.btn-theme:hover {
  transform: scale(1.1);
}

.sel-aero {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.sel-aero-label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.usuario-info {
  display: flex;
  flex-direction: column;
  font-size: 0.875rem;
}

.usuario-nome {
  font-weight: 600;
  color: var(--color-text-primary);
}

.usuario-aero {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.topo-descricao {
  color: var(--color-text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

.miolo {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.menu-overlay {
  display: none;
}

/* Responsividade para Tablets */
@media (max-width: 960px) {
  .conteudo {
    padding: 1.5rem;
  }

  .acoes-topo {
    gap: 0.5rem;
  }

  .usuario-info {
    display: none;
  }
}

/* Responsividade para Mobile */
@media (max-width: 768px) {
  .menu {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    transform: translateX(-100%);
    z-index: 2000;
  }

  .menu.menu-aberto {
    transform: translateX(0);
  }

  .btn-menu-close {
    display: block;
  }

  .menu-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1500;
  }

  .btn-menu-mobile {
    display: block;
  }

  .conteudo {
    padding: 1rem;
  }

  .topo-linha1 h1 {
    font-size: 1.25rem;
  }

  .acoes-topo {
    flex-direction: column;
    align-items: stretch;
  }

  .sel-aero {
    flex-direction: column;
    align-items: stretch;
  }

  .sel-aero select {
    width: 100%;
  }

  .topo-descricao {
    font-size: 0.85rem;
  }

  .miolo {
    gap: 1rem;
  }
}

/* Mobile pequeno */
@media (max-width: 480px) {
  .conteudo {
    padding: 0.75rem;
  }

  .logo {
    font-size: 1.2rem;
  }

  .menu {
    padding: 1.5rem 1rem;
  }
}
</style>
