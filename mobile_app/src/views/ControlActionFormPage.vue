<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Ações de controle</ion-title>
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
          <ion-title size="large">Registrar ação</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list inset>
        <ion-item>
          <ion-select v-model="form.airport_id" interface="popover" label="Aeroporto" @ion-change="carregarLocais">
            <ion-select-option v-for="airport in airports" :key="airport.airport_id" :value="airport.airport_id">
              {{ airport.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="form.location_id" interface="popover" label="Localização">
            <ion-select-option v-for="local in locais" :key="local.location_id" :value="local.location_id">
              {{ local.code }} - {{ local.description }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input type="date" v-model="form.date_utc" label="Data" />
        </ion-item>
        <ion-item>
          <ion-input type="time" v-model="form.time_local" label="Hora" />
        </ion-item>
        <ion-item>
          <ion-select v-model="form.action_type_id" interface="popover" label="Tipo de ação">
            <ion-select-option v-for="acao in lookups.tipos_acao ?? []" :key="acao.id" :value="acao.id">
              {{ acao.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="decimal" v-model.number="form.latitude_dec" label="Latitude" />
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="decimal" v-model.number="form.longitude_dec" label="Longitude" />
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="numeric" v-model.number="form.duration_min" label="Duração (min)" />
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="decimal" v-model.number="form.efficacy_percent" label="Eficácia (%)" />
        </ion-item>
        <ion-item>
          <ion-toggle v-model="form.lethal_control" justify="space-between">
            Controle letal
          </ion-toggle>
        </ion-item>
        <ion-item>
          <ion-textarea v-model="form.description" auto-grow label="Descrição" />
        </ion-item>
        <ion-item>
          <ion-textarea v-model="form.result_notes" auto-grow label="Resultados / Observações" />
        </ion-item>
      </ion-list>

      <div class="actions">
        <ion-button expand="block" @click="salvar" :disabled="submetendo">
          <ion-icon slot="start" :icon="saveOutline" />
          Registrar ação
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
        message="Ação registrada!"
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
  IonToggle,
  IonToolbar
} from '@ionic/vue';
import { locateOutline, saveOutline } from 'ionicons/icons';
import { onIonViewWillEnter } from '@ionic/vue';
import { Geolocation } from '@capacitor/geolocation';
import { reactive, ref } from 'vue';
import { ApiService } from '@/services/api';
import { useReferenceData } from '@/composables/useReferenceData';

const hoje = new Date().toISOString().slice(0, 10);
const form = reactive({
  airport_id: '' as number | '',
  location_id: null as number | null,
  date_utc: hoje,
  time_local: '',
  action_type_id: null as number | null,
  latitude_dec: null as number | null,
  longitude_dec: null as number | null,
  duration_min: null as number | null,
  result_notes: '',
  description: '',
  efficacy_percent: null as number | null,
  lethal_control: false
});

const locais = ref<any[]>([]);
const submetendo = ref(false);
const sucesso = ref(false);
const erro = ref<string | null>(null);
const { airports, lookups, loadReferenceData, getLocations } = useReferenceData();

onIonViewWillEnter(async () => {
  await loadReferenceData();
  if (!form.airport_id && airports.value.length) {
    form.airport_id = airports.value[0].airport_id;
    await carregarLocais();
  }
});

async function carregarLocais() {
  if (!form.airport_id) {
    locais.value = [];
    return;
  }
  locais.value = await getLocations(Number(form.airport_id));
  if (locais.value.length) {
    form.location_id = locais.value[0].location_id;
  }
}

async function capturarGps() {
  try {
    const pos = await Geolocation.getCurrentPosition();
    form.latitude_dec = Number(pos.coords.latitude.toFixed(6));
    form.longitude_dec = Number(pos.coords.longitude.toFixed(6));
  } catch (e: any) {
    erro.value = e?.message ?? 'GPS indisponível.';
  }
}

async function salvar() {
  if (!form.airport_id || !form.location_id) {
    erro.value = 'Selecione aeroporto e local.';
    return;
  }
  try {
    submetendo.value = true;
    erro.value = null;
    await ApiService.createControlAction({
      ...form,
      airport_id: Number(form.airport_id),
      location_id: Number(form.location_id)
    });
    sucesso.value = true;
    form.description = '';
    form.result_notes = '';
    form.duration_min = null;
    form.efficacy_percent = null;
    form.lethal_control = false;
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao registrar ação.';
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
