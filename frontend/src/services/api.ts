﻿import axios from 'axios';

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

  // Permissões
  getUserPermissions() {
    const user = getUser<any>();
    return user?.permissions || {
      can_create: false,
      can_read: true,
      can_update: false,
      can_delete: false,
      can_access_reports: false
    };
  },
  hasPermission(permission: 'can_create' | 'can_read' | 'can_update' | 'can_delete' | 'can_access_reports'): boolean {
    const permissions = this.getUserPermissions();
    return permissions[permission] === true;
  },
  canCreate() {
    return this.hasPermission('can_create');
  },
  canRead() {
    return this.hasPermission('can_read');
  },
  canUpdate() {
    return this.hasPermission('can_update');
  },
  canDelete() {
    return this.hasPermission('can_delete');
  },
  canAccessReports() {
    return this.hasPermission('can_access_reports');
  },
  isAdmin() {
    const user = getUser<any>();
    return user?.role_name === 'admin';
  },
  isViewer() {
    const user = getUser<any>();
    return user?.role_name === 'viewer';
  },
  async getKpisResumo(params?: Record<string, any>) {
    const { data } = await api.get('/api/kpis/resumo', { params });
    return data;
  },
  async getPareto(params?: Record<string, any>) {
    const { data } = await api.get('/api/relatorios/pareto-especies', { params });
    return data;
  },
  async getPainelResumo(params?: Record<string, any>) {
    const { data } = await api.get('/api/analytics/painel-resumo', { params });
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
  async getRelatorioMovimentos(params?: Record<string, any>) {
    const { data } = await api.get('/api/relatorios/movimentos-periodo', { params });
    return data;
  },
  async getRelatorioColisoesImagens(params?: Record<string, any>) {
    const { data } = await api.get('/api/relatorios/colisoes-imagens', { params });
    return data;
  },
  async exportarRelatorioColisoesImagens(params: Record<string, any>) {
    return api.get('/api/relatorios/colisoes-imagens/export', {
      params,
      responseType: 'blob'
    });
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
  // Inspeções Diárias (Monitoramento Diário de Fauna - F1)
  async getInspecoesDiarias(params?: Record<string, any>) {
    const { data } = await api.get('/api/inspecoes-diarias', { params });
    return data;
  },
  async getInspecaoDiaria(id: number) {
    const { data } = await api.get(`/api/inspecoes-diarias/${id}`);
    return data;
  },
  async criarInspecaoDiaria(payload: Record<string, any>) {
    const { data } = await api.post('/api/inspecoes-diarias', payload);
    return data;
  },
  async atualizarInspecaoDiaria(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/inspecoes-diarias/${id}`, payload);
    return data;
  },
  async removerInspecaoDiaria(id: number) {
    await api.delete(`/api/inspecoes-diarias/${id}`);
  },
  async exportarInspecoesDiarias(params?: Record<string, any>) {
    return api.get('/api/relatorios/inspecoes-diarias/export', {
      params,
      responseType: 'blob'
    });
  },
  // Inspeções de Proteção F4 (Sistema de Proteção)
  async getInspecoesProtecao(params?: Record<string, any>) {
    const { data } = await api.get('/api/inspecoes-protecao', { params });
    return data;
  },
  async getInspecaoProtecao(id: number) {
    const { data } = await api.get(`/api/inspecoes-protecao/${id}`);
    return data;
  },
  async criarInspecaoProtecao(formData: FormData) {
    const { data } = await api.post('/api/inspecoes-protecao', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },
  async removerInspecaoProtecao(id: number) {
    await api.delete(`/api/inspecoes-protecao/${id}`);
  },
  async exportarInspecoesProtecao(params?: Record<string, any>) {
    return api.get('/api/relatorios/inspecoes-protecao/export', {
      params,
      responseType: 'blob'
    });
  },
  // Coletas de Carcaça (F5)
  async getColetasCarcaca(params?: Record<string, any>) {
    const { data } = await api.get('/api/coletas-carcaca', { params });
    return data;
  },
  async getColetaCarcaca(id: number) {
    const { data } = await api.get(`/api/coletas-carcaca/${id}`);
    return data;
  },
  async criarColetaCarcaca(formData: FormData) {
    const { data } = await api.post('/api/coletas-carcaca', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },
  async removerColetaCarcaca(id: number) {
    await api.delete(`/api/coletas-carcaca/${id}`);
  },
  async exportarColetasCarcaca(params?: Record<string, any>) {
    return api.get('/api/relatorios/coletas-carcaca/export', {
      params,
      responseType: 'blob'
    });
  },
  // Inspeções de Lagos e Áreas Alagadiças
  async getInspecoesLagos(params?: Record<string, any>) {
    const { data } = await api.get('/api/inspecoes-lagos', { params });
    return data;
  },
  async criarInspecaoLago(formData: FormData) {
    const { data } = await api.post('/api/inspecoes-lagos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },
  async removerInspecaoLago(id: number) {
    await api.delete(`/api/inspecoes-lagos/${id}`);
  },
  async exportarInspecoesLagos(params?: Record<string, any>) {
    return api.get('/api/relatorios/inspecoes-lagos/export', {
      params,
      responseType: 'blob'
    });
  },
  // Manutenção de Áreas Verdes (F2)
  async getInspecoesAreasVerdes(params?: Record<string, any>) {
    const { data } = await api.get('/api/inspecoes-areas-verdes', { params });
    return data;
  },
  async criarInspecaoAreaVerde(payload: Record<string, any>) {
    const { data } = await api.post('/api/inspecoes-areas-verdes', payload);
    return data;
  },
  async atualizarInspecaoAreaVerde(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/inspecoes-areas-verdes/${id}`, payload);
    return data;
  },
  async removerInspecaoAreaVerde(id: number) {
    await api.delete(`/api/inspecoes-areas-verdes/${id}`);
  },
  async exportarInspecoesAreasVerdes(params?: Record<string, any>) {
    return api.get('/api/relatorios/inspecoes-areas-verdes/export', {
      params,
      responseType: 'blob'
    });
  },
  // Resíduos para Incineração
  async getResiduosIncineracao(params?: Record<string, any>) {
    const { data } = await api.get('/api/residuos-incineracao', { params });
    return data;
  },
  async getResiduoIncineracao(id: number) {
    const { data } = await api.get(`/api/residuos-incineracao/${id}`);
    return data;
  },
  async criarResiduoIncineracao(payload: Record<string, any>) {
    const { data } = await api.post('/api/residuos-incineracao', payload);
    return data;
  },
  async atualizarResiduoIncineracao(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/residuos-incineracao/${id}`, payload);
    return data;
  },
  async removerResiduoIncineracao(id: number) {
    await api.delete(`/api/residuos-incineracao/${id}`);
  },
  async exportarResiduosIncineracao(params?: Record<string, any>) {
    return api.get('/api/relatorios/residuos-incineracao/export', {
      params,
      responseType: 'blob'
    });
  },
  // Monitoramento de Focos de Atração (F3)
  async getInspecoesFocosAtracao(params?: Record<string, any>) {
    const { data } = await api.get('/api/inspecoes-focos-atracao', { params });
    return data;
  },
  async criarInspecaoFocoAtracao(payload: Record<string, any>) {
    const { data } = await api.post('/api/inspecoes-focos-atracao', payload);
    return data;
  },
  async atualizarInspecaoFocoAtracao(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/inspecoes-focos-atracao/${id}`, payload);
    return data;
  },
  async removerInspecaoFocoAtracao(id: number) {
    await api.delete(`/api/inspecoes-focos-atracao/${id}`);
  },
  async exportarInspecoesFocosAtracao(params?: Record<string, any>) {
    return api.get('/api/relatorios/inspecoes-focos-atracao/export', {
      params,
      responseType: 'blob'
    });
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
  async atualizarAsaFoco(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/asa-focos/${id}`, payload);
    return data;
  },
  async removerAsaFoco(id: number) {
    const { data } = await api.delete(`/api/asa-focos/${id}`);
    return data;
  },
  async getComunicadosExternos(params?: Record<string, any>) {
    const { data } = await api.get('/api/comunicados-externos', { params });
    return data;
  },
  async criarComunicadoExterno(payload: Record<string, any> | FormData) {
    const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
    const { data } = await api.post('/api/comunicados-externos', payload, config);
    return data;
  },
  async baixarAnexoComunicado(id: number) {
    return api.get(`/api/comunicados-externos/${id}/anexo`, { responseType: 'blob' });
  },
  async getTreinamentos(params?: Record<string, any>) {
    const { data } = await api.get('/api/treinamentos-fauna', { params });
    return data;
  },
  async criarTreinamento(payload: Record<string, any>) {
    const { data } = await api.post('/api/treinamentos-fauna', payload);
    return data;
  },
  async getUsuarios() {
    const { data } = await api.get('/api/usuarios');
    return data;
  },
  async criarUsuario(payload: Record<string, any>) {
    const { data } = await api.post('/api/usuarios', payload);
    return data;
  },
  async atualizarUsuario(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/usuarios/${id}`, payload);
    return data;
  },
  async removerUsuario(id: number) {
    await api.delete(`/api/usuarios/${id}`);
  },
  async resetSenhaUsuario(id: number) {
    const { data } = await api.post(`/api/usuarios/${id}/reset-senha`, {});
    return data;
  },
  async resetSenhaUsuarioLote(ids: number[]) {
    const { data } = await api.post('/api/usuarios/reset-senha', { user_ids: ids });
    return data;
  },
  async changePassword(payload: { current_password: string; new_password: string }) {
    const { data } = await api.post('/api/auth/change-password', payload);
    if (data?.token) setToken(data.token);
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
  async getQuadrantes() {
    const { data } = await api.get('/api/quadrantes');
    return data;
  },
  async getAeronaves() {
    const { data } = await api.get('/api/aeronaves');
    return data;
  },
  async criarAeronave(payload: Record<string, any>) {
    const { data } = await api.post('/api/aeronaves', payload);
    return data;
  },
  async atualizarAeronave(id: number, payload: Record<string, any>) {
    const { data } = await api.put(`/api/aeronaves/${id}`, payload);
    return data;
  },
  async removerAeronave(id: number) {
    await api.delete(`/api/aeronaves/${id}`);
  },
  async criarQuadrante(payload: { code: string; description?: string }) {
    const { data } = await api.post('/api/quadrantes', payload);
    return data;
  },
  async atualizarQuadrante(id: number, payload: { code?: string; description?: string }) {
    const { data } = await api.put(`/api/quadrantes/${id}`, payload);
    return data;
  },
  async removerQuadrante(id: number) {
    await api.delete(`/api/quadrantes/${id}`);
  },
  async resetQuadrantes() {
    const { data } = await api.post('/api/quadrantes/reset-grade', { confirm: 'matriz-33x14' });
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
    const [aeroportos, especies, lookups, quadrantes, aeronaves] = await Promise.all([
      api.get('/api/aeroportos'),
      api.get('/api/especies'),
      api.get('/api/lookups'),
      api.get('/api/quadrantes'),
      api.get('/api/aeronaves')
    ]);
    return {
      aeroportos: aeroportos.data,
      especies: especies.data,
      lookups: lookups.data,
      quadrantes: quadrantes.data,
      aeronaves: aeronaves.data
    };
  }
};
