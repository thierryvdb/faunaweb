import { ref } from 'vue';

export function useApiData<T>(fetcher: () => Promise<T>) {
  const dados = ref<T | null>(null);
  const carregando = ref(false);
  const erro = ref<string | null>(null);

  const executar = async () => {
    carregando.value = true;
    erro.value = null;
    try {
      dados.value = await fetcher();
    } catch (e: any) {
      erro.value = e?.message ?? 'Falha ao carregar dados';
    } finally {
      carregando.value = false;
    }
  };

  return { dados, carregando, erro, executar };
}
