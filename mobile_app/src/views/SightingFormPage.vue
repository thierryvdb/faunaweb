<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Avistamentos</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="capturarGps" :disabled="submetendo">
            <ion-icon slot="start" :icon="locateOutline" />
            GPS
          </ion-button>
          <ion-button fill="clear" @click="capturarFoto" :disabled="submetendo">
            <ion-icon slot="start" :icon="cameraOutline" />
            Foto
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Registrar avistamento</ion-title>
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
          <ion-input type="number" inputmode="decimal" v-model.number="form.latitude_dec" label="Latitude" />
        </ion-item>
        <ion-item>
          <ion-input type="number" inputmode="decimal" v-model.number="form.longitude_dec" label="Longitude" />
        </ion-item>
        <ion-item>
          <ion-select v-model="form.quadrant" interface="popover" label="Quadrante">
            <ion-select-option
              v-for="quadrant in lookups.quadrantes ?? []"
              :key="quadrant.code"
              :value="quadrant.code"
            >
              {{ quadrant.code }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="form.precip_id" interface="popover" label="Precipitação">
            <ion-select-option
              v-for="precip in lookups.precipitacao ?? []"
              :key="precip.id"
              :value="precip.id"
            >
              {{ precip.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="form.wind_id" interface="popover" label="Vento">
            <ion-select-option v-for="wind in lookups.vento ?? []" :key="wind.id" :value="wind.id">
              {{ wind.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="form.vis_id" interface="popover" label="Visibilidade">
            <ion-select-option v-for="vis in lookups.visibilidade ?? []" :key="vis.id" :value="vis.id">
              {{ vis.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-toggle v-model="form.inside_aerodrome" justify="space-between">
            Dentro do aeródromo
          </ion-toggle>
        </ion-item>
        <ion-item>
          <ion-textarea v-model="form.notes" auto-grow label="Notas" />
        </ion-item>
        <ion-item v-if="previewFoto">
          <div class="foto-preview">
            <img :src="previewFoto" alt="Foto da fauna" />
          </div>
        </ion-item>
      </ion-list>

      <section class="itens">
        <ion-list inset>
          <ion-list-header>
            <ion-label>Espécies observadas</ion-label>
            <ion-button size="small" fill="clear" @click="adicionarItem">
              <ion-icon slot="start" :icon="addCircleOutline" />
              Adicionar
            </ion-button>
          </ion-list-header>
          <ion-item v-for="(item, index) in form.itens" :key="index">
            <div class="item-grid">
              <ion-select v-model="item.species_id" interface="popover" label="Espécie">
                <ion-select-option v-for="sp in species" :key="sp.species_id" :value="sp.species_id">
                  {{ sp.common_name }}
                </ion-select-option>
              </ion-select>
              <ion-input
                type="number"
                inputmode="numeric"
                v-model.number="item.quantity"
                min="1"
                label="Quantidade"
              />
              <ion-input v-model="item.behavior" label="Comportamento" />
            </div>
            <ion-button slot="end" fill="clear" color="danger" @click="removerItem(index)">
              <ion-icon :icon="trashOutline" />
            </ion-button>
          </ion-item>
        </ion-list>
      </section>

      <div class="actions">
        <ion-button expand="block" @click="salvar" :disabled="submetendo">
          <ion-icon slot="start" :icon="saveOutline" />
          Registrar avistamento
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
        message="Avistamento registrado!"
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
  IonLabel,
  IonList,
  IonListHeader,
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
import {
  addCircleOutline,
  cameraOutline,
  locateOutline,
  saveOutline,
  trashOutline
} from 'ionicons/icons';
import { onIonViewWillEnter } from '@ionic/vue';
import { reactive, ref } from 'vue';
import { Geolocation } from '@capacitor/geolocation';
import { ApiService } from '@/services/api';
import { useReferenceData } from '@/composables/useReferenceData';
import { capturePhoto } from '@/composables/useCamera';

const agora = new Date();
const form = reactive({
  airport_id: '' as number | '',
  location_id: null as number | null,
  date_utc: agora.toISOString().slice(0, 10),
  time_local: agora.toISOString().slice(11, 16),
  latitude_dec: null as number | null,
  longitude_dec: null as number | null,
  quadrant: null as string | null,
  precip_id: null as number | null,
  wind_id: null as number | null,
  vis_id: null as number | null,
  inside_aerodrome: true,
  notes: '',
  itens: [
    { species_id: null as number | null, quantity: 1, behavior: '' }
  ],
  photo_url: ''
});

const locais = ref<any[]>([]);
const submetendo = ref(false);
const sucesso = ref(false);
const erro = ref<string | null>(null);
const previewFoto = ref<string | null>(null);
const { airports, species, lookups, loadReferenceData, getLocations } = useReferenceData();

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

async function capturarFoto() {
  try {
    const foto = await capturePhoto();
    if (foto) {
      form.photo_url = foto;
      previewFoto.value = foto;
    }
  } catch (e: any) {
    erro.value = e?.message ?? 'Erro ao capturar foto.';
  }
}

function adicionarItem() {
  form.itens.push({ species_id: null, quantity: 1, behavior: '' });
}

function removerItem(index: number) {
  form.itens.splice(index, 1);
  if (!form.itens.length) {
    adicionarItem();
  }
}

async function salvar() {
  if (!form.airport_id || !form.location_id) {
    erro.value = 'Selecione aeroporto e local.';
    return;
  }
  if (!form.itens.length || !form.itens[0].species_id) {
    erro.value = 'Informe ao menos uma espécie.';
    return;
  }
  try {
    submetendo.value = true;
    erro.value = null;
    const payload = {
      ...form,
      airport_id: Number(form.airport_id),
      location_id: Number(form.location_id),
      itens: form.itens
        .filter((item) => item.species_id)
        .map((item) => ({
          species_id: Number(item.species_id),
          quantity: Number(item.quantity ?? 1),
          behavior: item.behavior?.trim() || undefined
        }))
    };
    await ApiService.createSighting(payload);
    sucesso.value = true;
    form.notes = '';
    form.itens = [{ species_id: null, quantity: 1, behavior: '' }];
    previewFoto.value = null;
    form.photo_url = '';
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao registrar avistamento.';
  } finally {
    submetendo.value = false;
  }
}
</script>

<style scoped>
.actions {
  padding: 1rem;
}

.foto-preview {
  width: 100%;
  display: flex;
  justify-content: center;
}

.foto-preview img {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 12px;
}

.item-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

@media (min-width: 640px) {
  .item-grid {
    flex-direction: row;
    align-items: flex-end;
  }
  .item-grid ion-select,
  .item-grid ion-input {
    flex: 1;
  }
}
</style>
