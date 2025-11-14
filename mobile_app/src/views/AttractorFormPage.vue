<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Atrativos</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="capturarGps" :disabled="submetendo">
            <ion-icon slot="start" :icon="locateOutline" />
            GPS
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Registre um atrativo</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list inset>
        <ion-item>
          <ion-select v-model="form.airport_id" interface="popover" label="Aeroporto">
            <ion-select-option v-for="airport in airports" :key="airport.airport_id" :value="airport.airport_id">
              {{ airport.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input type="date" v-model="form.date_utc" label="Data" />
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="decimal" v-model.number="form.latitude_dec" label="Latitude" />
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="decimal" v-model.number="form.longitude_dec" label="Longitude" />
        </ion-item>
        <ion-item>
          <ion-select
            v-model="form.attractor_type_id"
            interface="popover"
            label="Tipo"
            placeholder="Selecione"
          >
            <ion-select-option
              v-for="tipo in lookups.tipos_atrativo ?? []"
              :key="tipo.id"
              :value="tipo.id"
            >
              {{ tipo.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input v-model.number="form.distance_m_runway" type="number" label="Distância até pista (m)" />
        </ion-item>
        <ion-item>
          <ion-select v-model="form.status" interface="popover" label="Status">
            <ion-select-option value="ativo">Ativo</ion-select-option>
            <ion-select-option value="mitigando">Mitigando</ion-select-option>
            <ion-select-option value="resolvido">Resolvido</ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input v-model="form.responsible_org" label="Responsável" placeholder="Orgão / Fornecedor" />
        </ion-item>
        <ion-item>
          <ion-textarea v-model="form.description" auto-grow label="Descrição" placeholder="O que está atraindo fauna?" />
        </ion-item>
      </ion-list>

      <div class="actions">
        <ion-button expand="block" @click="salvar" :disabled="submetendo">
          <ion-icon slot="start" :icon="saveOutline" />
          Registrar atrativo
        </ion-button>
      </div>

      <ion-toast
        :is-open="!!erro"
        color="danger"
        :message="erro ?? ''"
        :duration="3500"
        @didDismiss="erro = null"
      />
      <ion-toast
        :is-open="sucesso"
        color="success"
        message="Atrativo cadastrado!"
        :duration="2500"
        @didDismiss="sucesso = false"
      />
      <ion-loading :is-open="submetendo" message="Salvando..." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonLoading,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/vue';
import { locateOutline, saveOutline } from 'ionicons/icons';
import { onIonViewWillEnter } from '@ionic/vue';
import { reactive, ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { ApiService } from '@/services/api';
import { useReferenceData } from '@/composables/useReferenceData';

const hoje = new Date().toISOString().slice(0, 10);
const form = reactive({
  airport_id: '' as number | '',
  date_utc: hoje,
  latitude_dec: null as number | null,
  longitude_dec: null as number | null,
  attractor_type_id: null as number | null,
  description: '',
  distance_m_runway: null as number | null,
  status: 'ativo',
  responsible_org: ''
});

const submetendo = ref(false);
const sucesso = ref(false);
const erro = ref<string | null>(null);
const { airports, lookups, loadReferenceData } = useReferenceData();

onIonViewWillEnter(async () => {
  await loadReferenceData();
  if (!form.airport_id && airports.value.length) {
    form.airport_id = airports.value[0].airport_id;
  }
});

async function capturarGps() {
  try {
    const position = await Geolocation.getCurrentPosition();
    form.latitude_dec = Number(position.coords.latitude.toFixed(6));
    form.longitude_dec = Number(position.coords.longitude.toFixed(6));
  } catch (e: any) {
    erro.value = e?.message ?? 'Não foi possível obter localização.';
  }
}

async function salvar() {
  if (!form.airport_id) {
    erro.value = 'Selecione um aeroporto.';
    return;
  }
  try {
    submetendo.value = true;
    erro.value = null;
    await ApiService.createAttractor({
      ...form,
      airport_id: Number(form.airport_id)
    });
    sucesso.value = true;
    form.description = '';
    form.distance_m_runway = null;
    form.latitude_dec = null;
    form.longitude_dec = null;
    form.attractor_type_id = null;
    form.responsible_org = '';
  } catch (e: any) {
    erro.value = e?.message ?? 'Erro ao salvar atrativo.';
  } finally {
    submetendo.value = false;
  }
}
</script>

<style scoped>
.actions {
  padding: 1rem;
}
</style>
