# Plataforma de Monitoramento de Fauna

Aplicacao full-stack para operar o banco `wildlife` (PostgreSQL 12+ com PostGIS) definido em `wildlife_full_package.sql`. Ela entrega CRUDs separados, APIs para KPIs/relatorios e um frontend Vue focado em operacoes diarias, analises e visualizacoes.

## 1. Estrutura do banco

Resumo dos objetos principais do pacote SQL:

- **Tabelas maestras** (`airport`, `lu_*`) armazenam aeroportos, fases de voo, classes de dano, metodos de deteccao e demais dominios (`wildlife_full_package.sql:13-44`).
- **Dimensoes**: `dim_location` vincula pontos/areas operacionais (`wildlife_full_package.sql:47-57`), `dim_team` guarda as equipes de fauna vinculadas a cada aeroporto, e `dim_species` registra atributos biologicos com massa para calculos de severidade (`wildlife_full_package.sql:58-80`).
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

### 2.1 Extensão de conformidade (Manual ANAC/UFMG)

O arquivo `wildlife_extension.sql` amplia o pacote com tabelas e funções necessárias para aderir às boas práticas descritas no *Manual de Boas Práticas no Gerenciamento de Risco da Fauna*. Ele inclui:

- **fact_inspection** (inspeções diárias no sítio e na ASA com observações estruturadas).
- **fact_carcass**, **fact_environment_audit**, **fact_asa_focus**, **fact_external_notice** e **fact_training_session** para carcaças, resíduos/esgoto/sistemas de proteção, focos externos, comunicações e treinamentos.
- **fact_strike_cost**, **dim_personnel** e **fact_training_completion** para controle financeiro das colisões e acompanhamento de validades por função.
- Função `wildlife_kpi.fn_baist_indicadores` que calcula os indicadores BAIST (ReAvi/ReASA/ReFau, PeAvi/PeFau, strikes múltiplas, massa média, etc.).
- Endpoints dedicados no backend (`/api/inspecoes`, `/api/carcacas`, `/api/auditorias-ambientais`, `/api/asa-focos`, `/api/comunicados-externos`, `/api/pessoal`, `/api/treinamentos-conclusoes`, `/api/treinamentos/status`, `/api/analytics/*`) e páginas no frontend (Inspeções/ASA, Governança e Relatórios) para operar esses dados.
- Estrutura de usuários (`app_user`, `app_user_airport`) com colunas de status/troca obrigatória e APIs (`/api/usuarios*`, `/api/auth/change-password`) para gestão e redefinição de senha.

Se estiver usando o Dockerfile fornecido, os dois scripts já são copiados para `/docker-entrypoint-initdb.d` e executados automaticamente (01_wildlife_full_package.sql seguido de 02_wildlife_extension.sql). Para instalações manuais, após aplicar o `wildlife_full_package.sql`, rode:

```bash
psql -d fauna -f wildlife_extension.sql
```

O backend expõe as novas rotas (`/api/inspecoes`, `/api/carcacas`, `/api/auditorias-ambientais`, `/api/asa-focos`, `/api/comunicados-externos`, `/api/treinamentos-fauna` e `/api/kpis/baist`) e o frontend ganhou as telas **Inspeções/ASA** e **Governança** para operar esses dados.

## 3. Pre-requisitos

- Node.js >= 20 (testado com Node 24.x)
- Docker / Docker Desktop (para subir DB rapidamente)
- Yarn ou npm

### Instalar Node.js 24 + npm rapidamente

- **Windows (PowerShell / Windows Terminal):**
  ```powershell
  winget install CoreyButler.NVMforWindows -s winget
  nvm install 24.0.0
  nvm use 24.0.0
  ```
- **macOS (Homebrew + NVM):**
  ```bash
  brew install nvm
  mkdir -p ~/.nvm
  echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
  echo '[ -s "$(brew --prefix nvm)/nvm.sh" ] && \ . "$(brew --prefix nvm)/nvm.sh"' >> ~/.zshrc
  source ~/.zshrc
  nvm install 24
  nvm use 24
  ```
- **Ubuntu/Debian (NVM):**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.nvm/nvm.sh
  nvm install 24
  nvm use 24
  sudo apt-get install -y build-essential
  ```

Depois confirme com `node -v` e `npm -v`. O Vue/Vite já vem como dependência do projeto, então não é necessário instalar nada globalmente.

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

#### Windows (PowerShell)

```powershell
# Backend
cd backend
Copy-Item .env.example .env
npm install

# Frontend
cd ..\frontend
npm install
```

#### Linux/macOS (Bash)

```bash
# Backend
cd backend
cp .env.example .env
npm install

# Frontend
cd ../frontend
npm install
```

Após instalar, use `npm run dev` dentro de cada pasta para subir os servidores em modo desenvolvimento.

## 6. Preparar banco manualmente (alternativa)

1. Criar banco `fauna` (ou outro nome e ajustar `.env`).
2. Aplicar o pacote: `psql -d fauna -f wildlife_full_package.sql`.
3. Confirmar que os schemas `wildlife` e `wildlife_kpi` foram criados e as funcoes PostGIS estao disponiveis.

## 7. Backend (Fastify)

**Windows:**

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev    # http://localhost:3333
```

**Linux/macOS:**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Scripts: `npm run build` gera `dist/`, `npm start` sobe em modo producao.

## 8. Frontend (Vue 3)

**Windows:**

```powershell
cd frontend
npm install
npm run dev   # http://localhost:5173
```

**Linux/macOS:**

```bash
cd frontend
npm install
npm run dev
```

Variavel opcional `VITE_API_URL` pode apontar para outro host; caso vazio utiliza o proxy local.

## 9. Endpoints principais

| Metodo | Rota | Descricao |
| ------ | ---- | --------- |
| GET | `/api/lookups` | Dominios padrao para formularios |
| CRUD | `/api/aeroportos`, `/api/aeroportos/:id` | Cadastro de aeroportos |
| CRUD | `/api/aeroportos/:airportId/locais` | Locais operacionais |
| CRUD | `/api/aeroportos/:airportId/equipes` | Equipes de fauna por aeroporto |
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
| CRUD | `/api/inspecoes` | Inspeções do sítio/ASA com observações e quadrantes |
| CRUD | `/api/carcacas` | Registro de coleta/destino de carcaças |
| CRUD | `/api/auditorias-ambientais` | Auditorias de resíduos, esgoto e sistemas de proteção |
| CRUD | `/api/asa-focos` | Focos atrativos na ASA com protocolos e follow-ups |
| CRUD | `/api/comunicados-externos` | Ofícios, prazos e respostas de órgãos externos |
| CRUD | `/api/treinamentos-fauna` | Sessões de treinamento realizadas |
| CRUD | `/api/pessoal` | Cadastro de pessoas por função |
| CRUD | `/api/treinamentos-conclusoes` | Conclusões individuais com validade |
| GET | `/api/treinamentos/status` | Resumo de status por função e pendências próximas |
| GET | `/api/analytics/financeiro` | Indicadores financeiros de colisões por ano/categoria |
| GET | `/api/analytics/incidentes` | Distribuições avançadas por ano, espécie, tipo e dano |
| CRUD | `/api/usuarios` | Cadastro de usu?rios e aeroportos permitidos |
| POST | `/api/usuarios/:id/reset-senha` | Redefine a senha para o padr?o (`fauna1`) e for?a nova troca |
| POST | `/api/usuarios/reset-senha` | Redefine a senha de m?ltiplos usu?rios para `fauna1` |
| POST | `/api/auth/change-password` | Troca de senha pelo pr?prio usu?rio autenticado |
| CRUD | `/api/usuarios` | Cadastro de usu?rios e aeroportos permitidos |
| POST | `/api/usuarios/:id/reset-senha` | Redefine a senha para o padr?o (`fauna1`) e obriga nova troca |
| POST | `/api/auth/change-password` | Troca de senha pelo pr?prio usu?rio autenticado |


Todos os retornos utilizam textos em portugues e seguem validacao com Zod.

## 10. Telas e fluxos de UI

1. **Painel**: filtros de periodo, cards SR/10k por aeroporto, lista de taxa com dano e grafico Pareto (Chart.js).
2. **Movimentos**: tabela paginada + formulario rapido de cadastro.
3. **Avistamentos**: filtro por aeroporto/data, CRUD e integracao com itens; formulário usa selects para locais/equipes cadastrados e permite editar registros diretamente na tabela.
4. **Colisoes**: filtro por fase, formulario para evidenciar fase/dano.
5. **Acoes de Controle**: cadastro e painel rapido de BA espacial (chama `/api/kpis/ba-espacial`).
6. **Atrativos**: status (ativo/mitigando/resolvido) com formulario dedicado.
7. **Cadastros**: manutencao basica de aeroportos, especies, locais operacionais e equipes (CRUD completo por aeroporto), garantindo que avistamentos/colisoes usem IDs válidos.
8. **Inspecoes/ASA**: concentra inspeções do sítio/ASA, coleta de carcaças e auditorias ambientais com formulários orientados.
9. **Governanca**: painel único para focos ASA, comunicados externos, gestão de treinamentos, cadastro de pessoal e status automático de validade por função.
10. **Relatorios**: visualiza indicadores financeiros e análises (ano/categoria/espécie/tipo de incidente) em tabelas exportáveis.
11. **Usuarios**: cadastro de usuários do sistema, aeroportos permitidos e reset de senha padrão.

Cada modulo possui sua rota no Vue Router, evitando concentrar todos os CRUDs em uma unica pagina conforme solicitado.

## 11. Relatorios e KPIs

- `GET /api/kpis/resumo`: combina `v_movements_daily`, `v_strikes_daily`, `v_sightings_effort_daily` e massa por especie para entregar SR/10k, taxa de dano, TAH, severidade, identificacao e massa real por 1M movimentos.
- `POST /api/kpis/did`: chama `wildlife_kpi.kpi_did_sr10k` para comparar locais controle vs tratamento.
- `POST /api/kpis/ba-espacial`: utiliza `wildlife_kpi.kpi_ba_spatial` e retorna SR, limites e taxa de avistamentos antes/depois por buffer.
- `GET /api/relatorios/*`: replicas das views `rpt_*` com periodo dinamico.
- `GET /api/analytics/financeiro`: agrega custos de colisões (diretos, indiretos, outros) por ano, categoria taxonômica, tipo de incidente e dano.
- `GET /api/analytics/incidentes`: distribuições complementares (ano, categoria, espécie, fase de voo, tipo de incidente) para análises exigidas pelos manuais.

## 12. Testes e proximos passos

- Adicionar testes automatizados (Vitest para Vue e supertest para Fastify) validando principais fluxos.
- Implementar autenticacao/perfis para auditar alteracoes.
- Evoluir formularios de colisoes/avistamentos com componentes especificos para itens, upload de fotos e geolocalizacao.
- Criar dashboards adicionais usando `kpi_ba_sr_tah` e mapas (Leaflet ou Mapbox).
