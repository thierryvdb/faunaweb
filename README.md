# Plataforma de Monitoramento de Fauna

Aplicacao full-stack para operar o banco `wildlife` (PostgreSQL 12+ com PostGIS) definido em `wildlife_full_package.sql`. Ela entrega CRUDs separados, APIs para KPIs/relatorios e um frontend Vue focado em operacoes diarias, analises e visualizacoes.

## 1. Estrutura do banco

Resumo dos objetos principais do pacote SQL:

- **Tabelas maestras** (`airport`, `lu_*`) armazenam aeroportos, fases de voo, classes de dano, metodos de deteccao e demais dominios (`wildlife_full_package.sql:13-44`).
- **Dimensoes**: `dim_location` vincula pontos/areas operacionais (`wildlife_full_package.sql:47-57`) e `dim_species` guarda atributos biologicos e massa para calculos de severidade (`wildlife_full_package.sql:58-71`).
- **Fatos operacionais**: `fact_movement`, `fact_sighting`, `fact_sighting_item`, `fact_strike`, `fact_control_action` e `fact_attractor` cobrem movimentos, patrulhas, avistamentos, colisoes, acoes de controle e atrativos (`wildlife_full_package.sql:72-187`). Todos possuem `updated_at` com trigger `set_updated_at` (`wildlife_full_package.sql:201-216`).
- **Seeds** populam dominios padrao, aeroporto SBPS, locais e especies iniciais (`wildlife_full_package.sql:221-303`).
- **Views de agregacao** (`params_default_period`, `v_*`) montam diarios/mensais e bases para KPIs (`wildlife_full_package.sql:316-368`).
- **KPIs**: taxas SR/10k, dano, severidade, TAH, identificacao e massa movimentada sao expostas em `kpi_*` e relatorios `rpt_*` (`wildlife_full_package.sql:367-536`).
- **Funcoes estatisticas** `kpi_sr10k_byar`, `kpi_rate_ratio_ci`, `kpi_did_sr10k` e `kpi_ba_spatial` suportam analises de eficacia (DiD e Buffer Analysis) (`wildlife_full_package.sql:493-710`).

## 2. Arquitetura implementada

```
fauna/
+-- wildlife_full_package.sql
+-- Dockerfile.postgres     # banco Postgres 15 + PostGIS (docker)
+-- backend/                # API Fastify + TypeScript
+-- frontend/               # SPA Vue 3 + Vite + Chart.js
```

- **Backend** (`backend/`): Fastify + `pg` com validacao via Zod. Rotas separadas por dominio (`src/routes/*`) e servicos de banco (`src/services/db.ts`). KPIs e relatorios chamam diretamente as views/funcoes do schema `wildlife_kpi`.
- **Frontend** (`frontend/`): Vite + Vue Router + Chart.js. Telas isoladas (Painel, Movimentos, Avistamentos, Colisoes, Acoes, Atrativos, Cadastros) e componentes utilitarios (`KpiCard`, `DataTable`, `FiltroPeriodo`, `LoadingState`). Proxy local `/api` -> `http://localhost:3333`.

## 3. Pre-requisitos

- Node.js >= 18
- Docker / Docker Desktop (para subir DB rapidamente)
- Yarn ou npm

### Instalar Node.js + npm rapidamente

- **Windows (PowerShell / Windows Terminal):**
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
- **macOS (Homebrew):**
  ```bash
  brew install node@18
  echo 'export PATH="/opt/homebrew/opt/node@18/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
  ```
- **Ubuntu/Debian:**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential
  ```

Depois confirme com `node -v` e `npm -v`. O Vue/Vite já vem como dependência do projeto, não é necessário instalar nada globalmente.

## 4. Banco via Docker (PostgreSQL 15 + PostGIS)

O arquivo `Dockerfile.postgres` usa a imagem `postgis/postgis:15-3.4` e cria um banco `fauna` com usuario `fauna_admin` e senha `fauna_secret`. O script SQL e copiado para `/docker-entrypoint-initdb.d/01_wildlife_full_package.sql` e executado automaticamente no primeiro start. Workflow completo:

```bash
# 1) construir a imagem do banco
docker build -t fauna-db -f Dockerfile.postgres .

# 2) iniciar o container expondo a porta 5432
docker run -d --name fauna-db -p 5432:5432 fauna-db

# 3) (opcional) reaplicar/atualizar o pacote SQL manualmente
docker exec -i fauna-db \
  psql -U fauna_admin -d fauna \
  -f /docker-entrypoint-initdb.d/01_wildlife_full_package.sql
```

O backend ja esta configurado (ver `.env`) para conectar em `localhost:5432` com essas credenciais expostas pelo container.

## 5. Instalar dependencias do backend e frontend

As pastas `backend/` e `frontend/` possuem `package.json` separados. Rode os comandos abaixo uma única vez (ou após atualizar dependências) para instalar tudo que o Node precisa.

```bash
# Backend
cd backend
cp .env.example .env    # ajusta variaveis se necessario
npm install

# Frontend (novo terminal ou volte para a raiz antes)
cd ../frontend
npm install
```

Após instalar, use `npm run dev` dentro de cada pasta para subir os servidores em modo desenvolvimento.

## 6. Preparar banco manualmente (alternativa)

1. Criar banco `fauna` (ou outro nome e ajustar `.env`).
2. Aplicar o pacote: `psql -d fauna -f wildlife_full_package.sql`.
3. Confirmar que os schemas `wildlife` e `wildlife_kpi` foram criados e as funcoes PostGIS estao disponiveis.

## 7. Backend (Fastify)

```bash
cd backend
cp .env.example .env   # ja aponta para o container Docker
npm install            # ou yarn
npm run dev            # hot-reload em http://localhost:3333
```

Scripts: `npm run build` gera `dist/`, `npm start` sobe em modo producao.

## 8. Frontend (Vue 3)

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxy para /api)
```

Variavel opcional `VITE_API_URL` pode apontar para outro host; caso vazio utiliza o proxy local.

## 9. Endpoints principais

| Metodo | Rota | Descricao |
| ------ | ---- | --------- |
| GET | `/api/lookups` | Dominios padrao para formularios |
| CRUD | `/api/aeroportos`, `/api/aeroportos/:id` | Cadastro de aeroportos |
| CRUD | `/api/aeroportos/:airportId/locais` | Locais operacionais |
| CRUD | `/api/especies` | Dimensao de especies |
| CRUD | `/api/movimentos` | Movimentos diarios |
| CRUD | `/api/avistamentos` | Avistamentos + itens |
| CRUD | `/api/colisoes` | Colisoes com fauna |
| CRUD | `/api/acoes-controle` | Acoes de manejo |
| CRUD | `/api/atrativos` | Gestao de atrativos |
| GET | `/api/kpis/resumo` | KPIs dinamicos por periodo/ICAO |
| POST | `/api/kpis/did` | Difference-in-Differences para uma acao |
| POST | `/api/kpis/ba-espacial` | Buffer Analysis espacial |
| GET | `/api/relatorios/*` | Pareto de especies, fases de voo, partes com dano, janela BA |

Todos os retornos utilizam textos em portugues e seguem validacao com Zod.

## 10. Telas e fluxos de UI

1. **Painel**: filtros de periodo, cards SR/10k por aeroporto, lista de taxa com dano e grafico Pareto (Chart.js).
2. **Movimentos**: tabela paginada + formulario rapido de cadastro.
3. **Avistamentos**: filtro por aeroporto/data, CRUD e integracao com itens.
4. **Colisoes**: filtro por fase, formulario para evidenciar fase/dano.
5. **Acoes de Controle**: cadastro e painel rapido de BA espacial (chama `/api/kpis/ba-espacial`).
6. **Atrativos**: status (ativo/mitigando/resolvido) com formulario dedicado.
7. **Cadastros**: manutencao basica de aeroportos e especies para alimentar outros fluxos.

Cada modulo possui sua rota no Vue Router, evitando concentrar todos os CRUDs em uma unica pagina conforme solicitado.

## 11. Relatorios e KPIs

- `GET /api/kpis/resumo`: combina `v_movements_daily`, `v_strikes_daily`, `v_sightings_effort_daily` e massa por especie para entregar SR/10k, taxa de dano, TAH, severidade, identificacao e massa real por 1M movimentos.
- `POST /api/kpis/did`: chama `wildlife_kpi.kpi_did_sr10k` para comparar locais controle vs tratamento.
- `POST /api/kpis/ba-espacial`: utiliza `wildlife_kpi.kpi_ba_spatial` e retorna SR, limites e taxa de avistamentos antes/depois por buffer.
- `GET /api/relatorios/*`: replicas das views `rpt_*` com periodo dinamico.

## 12. Testes e proximos passos

- Adicionar testes automatizados (Vitest para Vue e supertest para Fastify) validando principais fluxos.
- Implementar autenticacao/perfis para auditar alteracoes.
- Evoluir formularios de colisoes/avistamentos com componentes especificos para itens, upload de fotos e geolocalizacao.
- Criar dashboards adicionais usando `kpi_ba_sr_tah` e mapas (Leaflet ou Mapbox).
