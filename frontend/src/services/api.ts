import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL,
  timeout: 10000
});

// Token helpers
const TOKEN_KEY = 'fauna_token';
const USER_KEY = 'fauna_user';
function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}
function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function setUser(user: any) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

function getUser<T = any>(): T | null {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function clearUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
}

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to /login on 401
api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err?.response?.status === 401 && !location.pathname.startsWith('/login')) {
      clearToken();
      clearUser();
      location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const ApiService = {
  // Auth & session
  async switchAirport(airportId: number) {
    const { data } = await api.post('/api/auth/switch-airport', { airport_id: airportId });
    if (data?.token) setToken(data.token);
    const user = getUser<any>() || {};
    setUser({ ...user, aeroporto: data?.aeroporto?.name, aeroporto_id: data?.aeroporto?.id });
    return data;
  },
  async login(username: string, password: string) {
    const { data } = await api.post('/api/auth/login', { username, password });
    if (data?.token) setToken(data.token);
    if (data?.usuario) {
      const user = { ...data.usuario, aeroportos_permitidos: data?.aeroportos_permitidos ?? [] };
      setUser(user);
    }
    return data;
  },
  getToken,
  setToken,
  clearToken,
  getUser,
  setUser,
  clearUser,
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
  async getAtrativosPorAeroporto(airportId: number) {
    const { data } = await api.get('/api/atrativos', { params: { airportId } });
    return data;
  },
  async getInspecoes(params?: Record<string, any>) {
    const { data } = await api.get('/api/inspecoes', { params });
    return data;
  },
  async criarInspecao(payload: Record<string, any>) {
    const { data } = await api.post('/api/inspecoes', payload);
    return data;
  },
  async getCarcacas(params?: Record<string, any>) {
    const { data } = await api.get('/api/carcacas', { params });
    return data;
  },
  async criarCarcaca(payload: Record<string, any>) {
    const { data } = await api.post('/api/carcacas', payload);
    return data;
  },
  async getAuditoriasAmbientais(params?: Record<string, any>) {
    const { data } = await api.get('/api/auditorias-ambientais', { params });
    return data;
  },
  async criarAuditoriaAmbiental(payload: Record<string, any>) {
    const { data } = await api.post('/api/auditorias-ambientais', payload);
    return data;
  },
  async getAsaFocos(params?: Record<string, any>) {
    const { data } = await api.get('/api/asa-focos', { params });
    return data;
  },
  async criarAsaFoco(payload: Record<string, any>) {
    const { data } = await api.post('/api/asa-focos', payload);
    return data;
  },
  async getComunicadosExternos(params?: Record<string, any>) {
    const { data } = await api.get('/api/comunicados-externos', { params });
    return data;
  },
  async criarComunicadoExterno(payload: Record<string, any>) {
    const { data } = await api.post('/api/comunicados-externos', payload);
    return data;
  },
  async getTreinamentos(params?: Record<string, any>) {
    const { data } = await api.get('/api/treinamentos-fauna', { params });
    return data;
  },
  async criarTreinamento(payload: Record<string, any>) {
    const { data } = await api.post('/api/treinamentos-fauna', payload);
    return data;
  },
  async getPessoal(params?: Record<string, any>) {
    const { data } = await api.get('/api/pessoal', { params });
    return data;
  },
  async criarPessoa(payload: Record<string, any>) {
    const { data } = await api.post('/api/pessoal', payload);
    return data;
  },
  async atualizarPessoa(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/pessoal/${id}`, payload);
    return data;
  },
  async removerPessoa(id: number) {
    await api.delete(`/api/pessoal/${id}`);
  },
  async getTreinamentoConclusoes(params?: Record<string, any>) {
    const { data } = await api.get('/api/treinamentos-conclusoes', { params });
    return data;
  },
  async criarTreinamentoConclusao(payload: Record<string, any>) {
    const { data } = await api.post('/api/treinamentos-conclusoes', payload);
    return data;
  },
  async atualizarTreinamentoConclusao(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/treinamentos-conclusoes/${id}`, payload);
    return data;
  },
  async removerTreinamentoConclusao(id: number) {
    await api.delete(`/api/treinamentos-conclusoes/${id}`);
  },
  async getStatusTreinamentos(params?: Record<string, any>) {
    const { data } = await api.get('/api/treinamentos/status', { params });
    return data;
  },
  async getFinanceiro(params?: Record<string, any>) {
    const { data } = await api.get('/api/analytics/financeiro', { params });
    return data;
  },
  async getAnaliseIncidentes(params?: Record<string, any>) {
    const { data } = await api.get('/api/analytics/incidentes', { params });
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
  async getKpisBaist(params?: Record<string, any>) {
    const { data } = await api.get('/api/kpis/baist', { params });
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

