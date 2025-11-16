import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import MovimentosView from '@/views/MovimentosView.vue';
import AvistamentosView from '@/views/AvistamentosView.vue';
import ColisoesView from '@/views/ColisoesView.vue';
import AcoesView from '@/views/AcoesView.vue';
import AtrativosView from '@/views/AtrativosView.vue';
import CadastrosView from '@/views/CadastrosView.vue';
import InspecoesView from '@/views/InspecoesView.vue';
import InspecoesDiariasView from '@/views/InspecoesDiariasView.vue';
import InspecoesProtecaoView from '@/views/InspecoesProtecaoView.vue';
import ColetasCarcacaView from '@/views/ColetasCarcacaView.vue';
import InspecoesLagosView from '@/views/InspecoesLagosView.vue';
import InspecoesAreasVerdesView from '@/views/InspecoesAreasVerdesView.vue';
import InspecoesFocosAtracaoView from '@/views/InspecoesFocosAtracaoView.vue';
import ResiduosIncineracaoView from '@/views/ResiduosIncineracaoView.vue';
import ASAView from '@/views/ASAView.vue';
import GovernancaView from '@/views/GovernancaView.vue';
import RelatoriosView from '@/views/RelatoriosView.vue';
import RelatorioColisoesImagensView from '@/views/RelatorioColisoesImagensView.vue';
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
    { path: '/inspecoes-asa', component: InspecoesDiariasView },
    { path: '/inspecoes-protecao', component: InspecoesProtecaoView },
    { path: '/coletas-carcaca', component: ColetasCarcacaView },
    { path: '/inspecoes-areas-verdes', component: InspecoesAreasVerdesView },
    { path: '/inspecoes-focos-atracao', component: InspecoesFocosAtracaoView },
    { path: '/residuos-incineracao', component: ResiduosIncineracaoView },
    { path: '/inspecoes-lagos', component: InspecoesLagosView },
    { path: '/asa', component: ASAView },
    { path: '/governanca', component: GovernancaView },
    { path: '/relatorios', component: RelatoriosView },
    { path: '/relatorios/colisoes-imagens', component: RelatorioColisoesImagensView },
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
