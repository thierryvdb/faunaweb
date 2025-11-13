import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import MovimentosView from '@/views/MovimentosView.vue';
import AvistamentosView from '@/views/AvistamentosView.vue';
import ColisoesView from '@/views/ColisoesView.vue';
import AcoesView from '@/views/AcoesView.vue';
import AtrativosView from '@/views/AtrativosView.vue';
import CadastrosView from '@/views/CadastrosView.vue';
import InspecoesView from '@/views/InspecoesView.vue';
import GovernancaView from '@/views/GovernancaView.vue';
import RelatoriosView from '@/views/RelatoriosView.vue';
import UsuariosView from '@/views/UsuariosView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue') },
    { path: '/', component: DashboardView },
    { path: '/movimentos', component: MovimentosView },
    { path: '/avistamentos', component: AvistamentosView },
    { path: '/colisoes', component: ColisoesView },
    { path: '/acoes', component: AcoesView },
    { path: '/atrativos', component: AtrativosView },
    { path: '/cadastros', component: CadastrosView },
    { path: '/inspecoes', component: InspecoesView },
    { path: '/governanca', component: GovernancaView },
    { path: '/relatorios', component: RelatoriosView },
    { path: '/usuarios', component: UsuariosView }
  ]
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('fauna_token');
  if (to.path !== '/login' && !token) {
    next('/login');
  } else {
    next();
  }
});

export default router;
