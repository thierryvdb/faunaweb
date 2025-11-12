import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL,
  timeout: 10000
});

export const ApiService = {
  async getKpisResumo(params?: Record<string, any>) {
    const { data } = await api.get('/api/kpis/resumo', { params });
    return data;
  },
  async getPareto(params?: Record<string, any>) {
    const { data } = await api.get('/api/relatorios/pareto-especies', { params });
    return data;
  },
  async getFases(params?: Record<string, any>) {
    const { data } = await api.get('/api/relatorios/fases-voo', { params });
    return data;
  },
  async getPartes(params?: Record<string, any>) {
    const { data } = await api.get('/api/relatorios/partes-dano', { params });
    return data;
  },
  async getMovimentos(params?: Record<string, any>) {
    const { data } = await api.get('/api/movimentos', { params });
    return data;
  },
  async getAvistamentos(params?: Record<string, any>) {
    const { data } = await api.get('/api/avistamentos', { params });
    return data;
  },
  async getColisoes(params?: Record<string, any>) {
    const { data } = await api.get('/api/colisoes', { params });
    return data;
  },
  async getAcoes(params?: Record<string, any>) {
    const { data } = await api.get('/api/acoes-controle', { params });
    return data;
  },
  async getAtrativos(params?: Record<string, any>) {
    const { data } = await api.get('/api/atrativos', { params });
    return data;
  },
  async getLocaisPorAeroporto(airportId: number) {
    const { data } = await api.get(`/api/aeroportos/${airportId}/locais`);
    return data;
  },
  async getEquipesPorAeroporto(airportId: number) {
    const { data } = await api.get(`/api/aeroportos/${airportId}/equipes`);
    return data;
  },
  async criarLocal(airportId: number, payload: { code: string; runway_ref?: string; description?: string }) {
    const { data } = await api.post(`/api/aeroportos/${airportId}/locais`, payload);
    return data;
  },
  async removerLocal(airportId: number, locationId: number) {
    await api.delete(`/api/aeroportos/${airportId}/locais/${locationId}`);
  },
  async getLookups() {
    const { data } = await api.get('/api/lookups');
    return data;
  },
  async getCadastros() {
    const [aeroportos, especies, lookups] = await Promise.all([
      api.get('/api/aeroportos'),
      api.get('/api/especies'),
      api.get('/api/lookups')
    ]);
    return { aeroportos: aeroportos.data, especies: especies.data, lookups: lookups.data };
  }
};
