<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard" href="/tabs/dashboard">
          <ion-icon :icon="speedometerOutline" />
          <ion-label>Painel</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="inspections" href="/tabs/inspecoes">
          <ion-icon :icon="clipboardOutline" />
          <ion-label>Inspeções</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="attractors" href="/tabs/atrativos">
          <ion-icon :icon="leafOutline" />
          <ion-label>Atrativos</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="actions" href="/tabs/acoes">
          <ion-icon :icon="hammerOutline" />
          <ion-label>Ações</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="sightings" href="/tabs/avistamentos">
          <ion-icon :icon="binocularsOutline" />
          <ion-label>Avist.</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonTabs,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel
} from '@ionic/vue';
import {
  binocularsOutline,
  clipboardOutline,
  hammerOutline,
  leafOutline,
  speedometerOutline
} from 'ionicons/icons';
</script>
