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
  // Auth
  async login(username: string, password: string) {
    const { data } = await api.post('/api/auth/login', { username, password });
    if (data?.token) setToken(data.token);
    if (data?.usuario) setUser(data.usuario);
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
