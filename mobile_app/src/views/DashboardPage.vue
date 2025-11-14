<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Painel Mobile</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="carregar">
            <ion-icon slot="start" :icon="refreshOutline" />
            Atualizar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Painel</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="filters">
        <ion-item>
          <ion-select
            label="Aeroporto"
            interface="popover"
            placeholder="Selecione"
            v-model="filtros.airportId"
            @ion-change="carregar"
          >
            <ion-select-option v-for="airport in airports" :key="airport.airport_id" :value="airport.airport_id">
              {{ airport.name }} ({{ airport.icao_code }})
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input label="Início" type="date" v-model="filtros.inicio" @ion-blur="carregar" />
        </ion-item>
        <ion-item>
          <ion-input label="Fim" type="date" v-model="filtros.fim" @ion-blur="carregar" />
        </ion-item>
      </div>

      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="6" v-for="card in cards" :key="card.title">
            <ion-card>
              <ion-card-header>
                <ion-card-subtitle>{{ card.subtitle }}</ion-card-subtitle>
                <ion-card-title>{{ card.title }}</ion-card-title>
              </ion-card-header>
              <ion-card-content>
                <div class="metric-value">{{ card.value }}</div>
                <p class="metric-description">{{ card.description }}</p>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>

      <ion-list v-if="metricas.length">
        <ion-list-header>
          <ion-label>Resumo detalhado</ion-label>
        </ion-list-header>
        <ion-item v-for="airport in metricas" :key="airport.airport_id">
          <ion-label>
            <h2>{{ airport.nome }}</h2>
            <p>Movimentos: {{ formatInt(airport.movimentos) }} · Strikes: {{ formatInt(airport.strikes) }}</p>
            <p>SR10k: {{ formatDecimal(airport.sr10k) }} · Danos/10k: {{ formatDecimal(airport.damage_rate_10k) }}</p>
            <p>T.A.H: {{ formatDecimal(airport.tah_itens_por_hora) }} · Massa total (kg): {{ formatDecimal(massaKg(airport.massa_total_grams)) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <ion-toast :is-open="!!erro" :message="erro ?? ''" color="danger" :duration="3000" @didDismiss="erro = null" />
      <ion-toast
        :is-open="atualizado"
        message="Painel atualizado"
        color="success"
        :duration="2000"
        @didDismiss="atualizado = false"
      />
      <ion-loading :is-open="carregando" message="Buscando métricas..." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonLoading,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/vue';
import { refreshOutline } from 'ionicons/icons';
import { computed, reactive, ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { ApiService } from '@/services/api';
import { useReferenceData } from '@/composables/useReferenceData';

const hoje = new Date();
const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
const fimPadrao = new Date().toISOString().slice(0, 10);

const filtros = reactive({
  airportId: '' as number | '' ,
  inicio: inicioPadrao,
  fim: fimPadrao
});

const metricas = ref<any[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);
const atualizado = ref(false);
const { airports, loadReferenceData } = useReferenceData();

onIonViewWillEnter(async () => {
  await loadReferenceData();
  if (!filtros.airportId && airports.value.length) {
    filtros.airportId = airports.value[0].airport_id;
  }
  await carregar();
});

const cards = computed(() => {
  if (!metricas.value.length) return [];
  const item = metricas.value[0];
  return [
    {
      title: formatInt(item.movimentos),
      subtitle: 'Movimentos',
      value: `${formatInt(item.strikes)} strikes`,
      description: 'Eventos registrados no período selecionado.'
    },
    {
      title: `${formatDecimal(item.sr10k)} SR/10k`,
      subtitle: 'Taxa de risco',
      value: `${formatDecimal(item.damage_rate_10k)} danos/10k`,
      description: 'Strikes e danos ponderados por movimentos.'
    },
    {
      title: `${formatDecimal(item.tah_itens_por_hora)} itens/h`,
      subtitle: 'Esforço ASA',
      value: `Severidade média ${formatDecimal(item.severidade_media)}`,
      description: 'Eficiência das patrulhas e risco combinado.'
    },
    {
      title: `${formatDecimal(massaKg(item.massa_total_grams))} kg`,
      subtitle: 'Carga biológica',
      value: `Identificação ${formatDecimal(item.pct_identificados)}%`,
      description: 'Massa total estimada das espécies envolvidas.'
    }
  ];
});

async function carregar() {
  try {
    carregando.value = true;
    erro.value = null;
    const params: Record<string, unknown> = {
      inicio: filtros.inicio,
      fim: filtros.fim
    };
    if (filtros.airportId) {
      params.airportId = filtros.airportId;
    }
    const data = await ApiService.getDashboardMetrics(params);
    metricas.value = data?.aeroportos ?? [];
    atualizado.value = true;
  } catch (e: any) {
    erro.value = e?.message ?? 'Não foi possível carregar o painel';
  } finally {
    carregando.value = false;
  }
}

function formatInt(valor?: number | null) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toLocaleString('pt-BR');
}

function formatDecimal(valor?: number | null) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '-';
  return Number(valor).toFixed(2);
}

function massaKg(gramas?: number | null) {
  if (!gramas) return null;
  return gramas / 1000;
}

function onRefresh(event: CustomEvent) {
  carregar().finally(() => event.detail.complete());
}
</script>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 1rem 1rem;
}

.metric-value {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.metric-description {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
</style>
