<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Inspeções / ASA</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="limparForm">
            <ion-icon slot="start" :icon="refreshOutline" />
            Limpar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Inspeções</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list inset>
        <ion-item>
          <ion-select
            v-model="form.airport_id"
            label="Aeroporto"
            interface="popover"
            placeholder="Selecione"
          >
            <ion-select-option v-for="airport in airports" :key="airport.airport_id" :value="airport.airport_id">
              {{ airport.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-segment v-model="form.inspection_type">
            <ion-segment-button value="site">Sítio</ion-segment-button>
            <ion-segment-button value="asa">ASA</ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item>
          <ion-input v-model="form.date_utc" type="date" label="Data" />
        </ion-item>
        <ion-item>
          <ion-input v-model="form.start_time" type="time" label="Início" />
        </ion-item>
        <ion-item>
          <ion-input v-model="form.end_time" type="time" label="Fim" />
        </ion-item>
        <ion-item>
          <ion-input v-model="form.team_name" label="Equipe" placeholder="Equipe de inspeção" />
        </ion-item>
        <ion-item>
          <ion-textarea
            v-model="form.weather_summary"
            auto-grow
            label="Condições"
            placeholder="Resumo do clima"
          />
        </ion-item>
        <ion-item>
          <ion-textarea v-model="form.route_summary" auto-grow label="Rota" placeholder="Trechos percorridos" />
        </ion-item>
        <ion-item>
          <ion-select
            v-model="form.grid_refs"
            label="Quadrantes"
            multiple
            interface="popover"
            placeholder="Selecione quadrantes"
          >
            <ion-select-option
              v-for="quadrant in lookups.quadrantes ?? []"
              :key="quadrant.id"
              :value="quadrant.code"
            >
              {{ quadrant.code }} - {{ quadrant.description }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input v-model="form.reported_by_name" label="Responsável" placeholder="Quem registrou" />
        </ion-item>
        <ion-item>
          <ion-textarea v-model="form.notes" auto-grow label="Notas adicionais" />
        </ion-item>
      </ion-list>

      <div class="actions">
        <ion-button expand="block" @click="salvar" :disabled="submetendo">
          <ion-icon slot="start" :icon="saveOutline" />
          Registrar inspeção
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
        message="Inspeção registrada!"
        :duration="2500"
        @didDismiss="sucesso = false"
      />
      <ion-loading :is-open="submetendo" message="Enviando..." />
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
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/vue';
import { saveOutline, refreshOutline } from 'ionicons/icons';
import { reactive, ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import { ApiService } from '@/services/api';
import { useReferenceData } from '@/composables/useReferenceData';

const hoje = new Date().toISOString().slice(0, 10);
const form = reactive({
  airport_id: '' as number | '',
  inspection_type: 'site',
  date_utc: hoje,
  start_time: '',
  end_time: '',
  team_name: '',
  weather_summary: '',
  route_summary: '',
  grid_refs: [] as string[],
  reported_by_name: '',
  notes: ''
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

async function salvar() {
  if (!form.airport_id) {
    erro.value = 'Selecione um aeroporto.';
    return;
  }
  try {
    submetendo.value = true;
    erro.value = null;
    await ApiService.createInspection({
      ...form,
      airport_id: Number(form.airport_id),
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      grid_refs: form.grid_refs ?? []
    });
    sucesso.value = true;
    limparForm();
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao salvar inspeção.';
  } finally {
    submetendo.value = false;
  }
}

function limparForm() {
  form.inspection_type = 'site';
  form.date_utc = new Date().toISOString().slice(0, 10);
  form.start_time = '';
  form.end_time = '';
  form.team_name = '';
  form.weather_summary = '';
  form.route_summary = '';
  form.grid_refs = [];
  form.reported_by_name = '';
  form.notes = '';
}
</script>

<style scoped>
.actions {
  padding: 1rem;
}
</style>
