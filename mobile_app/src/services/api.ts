const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

let authToken: string | null = null;

function buildUrl(path: string, params?: Record<string, unknown>) {
  if (!params || !Object.keys(params).length) {
    return `${API_BASE_URL}${path}`;
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  return `${API_BASE_URL}${path}?${search.toString()}`;
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  const response = await fetch(path, {
    ...options,
    headers
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro (${response.status}) ao comunicar com o servidor.`);
  }
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export const ApiService = {
  setToken(token: string | null) {
    authToken = token;
  },
  getToken() {
    return authToken;
  },
  async getAirports() {
    return request(buildUrl('/api/aeroportos'), { method: 'GET' });
  },
  async getSpecies() {
    return request(buildUrl('/api/especies'), { method: 'GET' });
  },
  async getLookups() {
    return request(buildUrl('/api/lookups'), { method: 'GET' });
  },
  async getLocations(airportId: number) {
    return request(buildUrl(`/api/aeroportos/${airportId}/locais`), { method: 'GET' });
  },
  async getDashboardMetrics(params: Record<string, unknown>) {
    return request(buildUrl('/api/kpis/resumo', params), { method: 'GET' });
  },
  async createInspection(payload: Record<string, unknown>) {
    return request(buildUrl('/api/inspecoes'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async createAttractor(payload: Record<string, unknown>) {
    return request(buildUrl('/api/atrativos'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async createControlAction(payload: Record<string, unknown>) {
    return request(buildUrl('/api/acoes-controle'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async createSighting(payload: Record<string, unknown>) {
    return request(buildUrl('/api/avistamentos'), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
