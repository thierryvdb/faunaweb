import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import MovimentosView from '@/views/MovimentosView.vue';
import AvistamentosView from '@/views/AvistamentosView.vue';
import ColisoesView from '@/views/ColisoesView.vue';
import AcoesView from '@/views/AcoesView.vue';
import AtrativosView from '@/views/AtrativosView.vue';
import CadastrosView from '@/views/CadastrosView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: DashboardView },
    { path: '/movimentos', component: MovimentosView },
    { path: '/avistamentos', component: AvistamentosView },
    { path: '/colisoes', component: ColisoesView },
    { path: '/acoes', component: AcoesView },
    { path: '/atrativos', component: AtrativosView },
    { path: '/cadastros', component: CadastrosView }
  ]
});

export default router;
