<template>
  <div class="relatorio-img">
    <header class="bloco-topo">
      <div>
        <h2>Relatório de colisões com imagens</h2>
        <p>Selecione o período e exporte em PDF ou DOCX. Esta página foi projetada para abrir em uma nova aba.</p>
      </div>
      <form class="filtros" @submit.prevent="carregar">
        <label>
          Aeroporto
          <select v-model="filtros.airportId">
            <option value="">Todos</option>
            <option v-for="a in aeroportos" :key="a.id ?? a.airport_id" :value="a.id ?? a.airport_id">
              {{ a.name ?? a.nome }}
            </option>
          </select>
        </label>
        <label>
          Início
          <input type="date" v-model="filtros.inicio" required />
        </label>
        <label>
          Fim
          <input type="date" v-model="filtros.fim" required />
        </label>
        <button class="btn" type="submit">Carregar</button>
        <button class="btn btn-secondary" type="button" :disabled="!dados.length || exportando" @click="exportar('pdf')">
          Exportar PDF
        </button>
        <button class="btn btn-secondary" type="button" :disabled="!dados.length || exportando" @click="exportar('docx')">
          Exportar DOCX
        </button>
      </form>
    </header>

    <LoadingState :carregando="carregando" :erro="erro">
      <p class="periodo" v-if="periodo">Período retornado: {{ periodo.inicio }} até {{ periodo.fim }} — {{ dados.length }} registros</p>
      <div v-if="dados.length" class="grid-cards">
        <article v-for="item in dados" :key="item.id" class="card">
          <header>
            <h3>Colisão #{{ item.id }}</h3>
            <span>{{ item.date_utc }} {{ item.time_local ?? '' }}</span>
          </header>
          <p><strong>Aeroporto:</strong> {{ item.aeroporto ?? item.airport_id }}</p>
          <p><strong>Local:</strong> {{ item.location_nome ?? item.location_id }}</p>
          <p><strong>Evento:</strong> {{ item.event_type ?? 'n/d' }}</p>
          <p><strong>Espécie:</strong> {{ item.especie ?? 'Não informada' }}</p>
          <p><strong>Dano:</strong> {{ item.dano ?? 'Não informado' }}</p>
          <p v-if="item.notes"><strong>Notas:</strong> {{ item.notes }}</p>
          <div class="imagem">
            <template v-if="item.fotos_base64?.length">
              <div class="galeria-imagens">
                <img v-for="(foto, idx) in item.fotos_base64" :key="idx" :src="foto" alt="Imagem da colisão" />
              </div>
            </template>
            <img v-else-if="item.foto_base64" :src="item.foto_base64" alt="Imagem da colisão" />
            <p v-else-if="item.photo_url">
              Foto externa:
              <a :href="item.photo_url" target="_blank" rel="noreferrer">{{ item.photo_url }}</a>
            </p>
            <p v-else>Sem imagem disponibilizada.</p>
          </div>
        </article>
      </div>
      <p v-else class="sem-dados">Nenhuma colisão encontrada para o período informado.</p>
    </LoadingState>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import LoadingState from '@/components/LoadingState.vue';
import { ApiService } from '@/services/api';

const hoje = new Date();
const fimPadrao = hoje.toISOString().slice(0, 10);
const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate()).toISOString().slice(0, 10);

const filtros = ref<{ airportId: string | number | ''; inicio: string; fim: string }>({
  airportId: '',
  inicio: inicioPadrao,
  fim: fimPadrao
});
const aeroportos = ref<any[]>([]);
const dados = ref<any[]>([]);
const periodo = ref<{ inicio: string; fim: string } | null>(null);
const carregando = ref(false);
const exportando = ref(false);
const erro = ref<string | null>(null);

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    const params: Record<string, any> = {
      inicio: filtros.value.inicio,
      fim: filtros.value.fim
    };
    if (filtros.value.airportId) {
      params.airportId = filtros.value.airportId;
    }
    const resposta = await ApiService.getRelatorioColisoesImagens(params);
    dados.value = resposta.dados ?? [];
    periodo.value = resposta.periodo ?? null;
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao buscar o relatório';
  } finally {
    carregando.value = false;
  }
}

async function exportar(formato: 'pdf' | 'docx') {
  exportando.value = true;
  try {
    const params: Record<string, any> = {
      inicio: filtros.value.inicio,
      fim: filtros.value.fim,
      formato
    };
    if (filtros.value.airportId) {
      params.airportId = filtros.value.airportId;
    }
    const resposta = await ApiService.exportarRelatorioColisoesImagens(params);
    const contentType =
      resposta.headers['content-type'] ??
      (formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const blob = new Blob([resposta.data], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nomeHeader = resposta.headers['content-disposition'] ?? '';
    const nomeArquivo = nomeHeader.split('filename=').pop()?.replace(/"/g, '') ?? `relatorio-colisoes.${formato}`;
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    alert(e?.message ?? 'Não foi possível exportar o relatório');
  } finally {
    exportando.value = false;
  }
}

onMounted(async () => {
  try {
    const cad = await ApiService.getCadastros();
    aeroportos.value = cad.aeroportos ?? [];
    const user = ApiService.getUser<any>();
    if (user?.aeroporto_id) {
      filtros.value.airportId = user.aeroporto_id;
    }
  } catch (e: any) {
    erro.value = e?.message ?? 'Falha ao carregar aeroportos';
  } finally {
    await carregar();
  }
});
</script>

<style scoped>
.relatorio-img { display: flex; flex-direction: column; gap: 1.5rem; }
.bloco-topo { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
.filtros { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; }
.filtros label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.btn { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; background: #0f172a; color: #fff; cursor: pointer; }
.btn-secondary { background: #475569; }
.grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
.card header { display: flex; justify-content: space-between; font-weight: 600; }
.galeria-imagens { display: flex; flex-direction: column; gap: 0.75rem; }
.imagem img { width: 100%; border-radius: 10px; border: 1px solid #dbeafe; object-fit: cover; max-height: 240px; }
.sem-dados { text-align: center; color: #475569; }
.periodo { font-size: 0.9rem; color: #475569; }
@media (max-width: 640px) {
  .filtros { flex-direction: column; align-items: stretch; }
  .btn, .btn-secondary { width: 100%; text-align: center; }
}
</style>
