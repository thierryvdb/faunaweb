import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';
import DashboardPage from '@/views/DashboardPage.vue';
import InspectionFormPage from '@/views/InspectionFormPage.vue';
import AttractorFormPage from '@/views/AttractorFormPage.vue';
import ControlActionFormPage from '@/views/ControlActionFormPage.vue';
import SightingFormPage from '@/views/SightingFormPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/tabs/dashboard'
  },
  {
    path: '/tabs',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/dashboard'
      },
      {
        path: 'dashboard',
        component: DashboardPage
      },
      {
        path: 'inspecoes',
        component: InspectionFormPage
      },
      {
        path: 'atrativos',
        component: AttractorFormPage
      },
      {
        path: 'acoes',
        component: ControlActionFormPage
      },
      {
        path: 'avistamentos',
        component: SightingFormPage
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/tabs/dashboard'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

export default router;
