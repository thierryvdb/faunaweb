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

### 2.1 ExtensÃƒÂƒÃ‚Â£o de conformidade (Manual ANAC/UFMG)

O arquivo `wildlife_extension.sql` amplia o pacote com tabelas e funÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes necessÃƒÂƒÃ‚Â¡rias para aderir ÃƒÂƒÃ‚Â s boas prÃƒÂƒÃ‚Â¡ticas descritas no *Manual de Boas PrÃƒÂƒÃ‚Â¡ticas no Gerenciamento de Risco da Fauna*. Ele inclui:

- **fact_inspection** (inspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes diÃƒÂƒÃ‚Â¡rias no sÃƒÂƒÃ‚Â­tio e na ASA com observaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes estruturadas).
- **fact_carcass**, **fact_environment_audit**, **fact_asa_focus**, **fact_external_notice** e **fact_training_session** para carcaÃƒÂƒÃ‚Â§as, resÃƒÂƒÃ‚Â­duos/esgoto/sistemas de proteÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o, focos externos, comunicaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes e treinamentos.
- **fact_strike_cost**, **dim_personnel** e **fact_training_completion** para controle financeiro das colisÃƒÂƒÃ‚Âµes e acompanhamento de validades por funÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o.
- FunÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o `wildlife_kpi.fn_baist_indicadores` que calcula os indicadores BAIST (ReAvi/ReASA/ReFau, PeAvi/PeFau, strikes mÃƒÂƒÃ‚Âºltiplas, massa mÃƒÂƒÃ‚Â©dia, etc.).
- Endpoints dedicados no backend (`/api/inspecoes`, `/api/carcacas`, `/api/auditorias-ambientais`, `/api/asa-focos`, `/api/comunicados-externos`, `/api/pessoal`, `/api/treinamentos-conclusoes`, `/api/treinamentos/status`, `/api/analytics/*`) e pÃƒÂƒÃ‚Â¡ginas no frontend (InspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes/ASA, GovernanÃƒÂƒÃ‚Â§a e RelatÃƒÂƒÃ‚Â³rios) para operar esses dados.
- Estrutura de usuÃƒÂƒÃ‚Â¡rios (`app_user`, `app_user_airport`) com colunas de status/troca obrigatÃƒÂƒÃ‚Â³ria e APIs (`/api/usuarios*`, `/api/auth/change-password`) para gestÃƒÂƒÃ‚Â£o e redefiniÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o de senha.

Se estiver usando o Dockerfile fornecido, os dois scripts jÃƒÂƒÃ‚Â¡ sÃƒÂƒÃ‚Â£o copiados para `/docker-entrypoint-initdb.d` e executados automaticamente (01_wildlife_full_package.sql seguido de 02_wildlife_extension.sql). Para instalaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes manuais, apÃƒÂƒÃ‚Â³s aplicar o `wildlife_full_package.sql`, rode:

```bash
psql -d fauna -f wildlife_extension.sql
```

O backend expÃƒÂƒÃ‚Âµe as novas rotas (`/api/inspecoes`, `/api/carcacas`, `/api/auditorias-ambientais`, `/api/asa-focos`, `/api/comunicados-externos`, `/api/treinamentos-fauna` e `/api/kpis/baist`) e o frontend ganhou as telas **InspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes/ASA** e **GovernanÃƒÂƒÃ‚Â§a** para operar esses dados.

### 2.2 PÃƒÂƒÃ‚Â¡ginas e fluxos principais do portal

- **Painel**: KPIs SR/10k, taxa de dano e pareto de espÃƒÂƒÃ‚Â©cies agrupados por aeroporto.
- **Movimentos**: CRUD com filtros e paginaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o que alimenta o KPI de exposiÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o e o relatÃƒÂƒÃ‚Â³rio /api/relatorios/movimentos-periodo.
- **Avistamentos**: formulÃƒÂƒÃ‚Â¡rio compatÃƒÂƒÃ‚Â­vel com o FC-15, jÃƒÂƒÃ‚Â¡ com seleÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o de quadrante/latitude/longitude e associaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o de equipe.
- **Colisoes**: registro completo do FC-15 com upload multiplo (arquivos locais sao redimensionados para 1600px/1920px via Sharp antes de salvar), suporte a URLs externas, controle de quadrante/latitude/longitude, campos de custo (direto/indireto/outros) e flag de atraso de voo com minutos afetados. Todas as fotos ficam em `fact_strike_foto` e abastecem os relatorios.
- **AÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes de Controle / Atrativos**: acompanhamento das medidas mitigatÃƒÂƒÃ‚Â³rias e dos focos que atraem fauna.
- **InspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes/ASA e GovernanÃƒÂƒÃ‚Â§a**: telas dedicadas ÃƒÂƒÃ‚Â s tabelas do *Manual de Boas PrÃƒÂƒÃ‚Â¡ticas*, cobrindo inspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes de sÃƒÂƒÃ‚Â­tio/ASA, auditorias ambientais, focos externos e comunicados.
- **RelatÃƒÂƒÃ‚Â³rios**: consultas Pareto/Fases/Partes e novos relatÃƒÂƒÃ‚Â³rios de movimentos por perÃƒÂƒÃ‚Â­odo e colisÃƒÂƒÃ‚Âµes com imagens (exportaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o em PDF ou DOCX).
- **Cadastros e UsuÃƒÂƒÃ‚Â¡rios**: administraÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o de aeroportos, locais, equipes, quadrantes, espÃƒÂƒÃ‚Â©cies e contas de acesso.

### 2.3 Ferramentas de apoio ao gerenciamento de risco de fauna

- **Grade ÃƒÂƒÃ‚Âºnica de quadrantes AÃƒÂ¢Ã¢Â‚Â¬Ã¢Â€ÂœN ÃƒÂƒÃ¢Â€Â” 1ÃƒÂ¢Ã¢Â‚Â¬Ã¢Â€Âœ33**: `lu_quadrant` guarda linha/coluna e pode ser regenerada via `POST /api/quadrantes/reset-grade` ou pelo botÃƒÂƒÃ‚Â£o ÃƒÂ¢Ã¢Â‚Â¬Ã…Â“Gerar grade A-N x 1-33ÃƒÂ¢Ã¢Â‚Â¬Ã‚Â na tela de Cadastros.
- **Mapa clicÃƒÂƒÃ‚Â¡vel**: o componente `QuadrantMapPicker` (ativado em Avistamentos e ColisÃƒÂƒÃ‚Âµes) permite escolher visualmente o quadrante e, opcionalmente, preencher latitude/longitude ao configurar `QUADRANT_MAP.bounds` em `src/config/quadrantGrid.ts`. A imagem pode ser trocada apontando `VITE_QUADRANT_MAP_URL` para um arquivo customizado.
- **Upload de evidencias**: o formulario aceita uma ou mais fotos locais (tratadas com Sharp para 1600px/1920px e salvas em `fact_strike_foto`) e URLs externas opcionais. A tela mostra previews, permite remover itens antes do envio e reaproveita os blobs em relatorios/exportacoes.
- **RelatÃƒÂƒÃ‚Â³rios exportÃƒÂƒÃ‚Â¡veis**:
  - `GET /api/relatorios/movimentos-periodo`: agrega totais mensais, soma anual por ano selecionado e mostra a variacao percentual contra os anos vizinhos.
  - `GET /api/relatorios/colisoes-imagens` e `/export`: lista as colisÃƒÂƒÃ‚Âµes com miniaturas e gera PDF ou DOCX para anexos em comissÃƒÂƒÃ‚Âµes ou auditorias.
  - `GET /api/relatorios/incidentes/export`: exporta em PDF ou DOCX as distribuicoes mostradas na pagina Analise de incidentes (ano, categoria, especie, fase de voo e tipo de incidente).
- **Conformidade com o Manual**: inspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes ASA, auditorias ambientais, focos externos, comunicaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes e treinamentos com alertas de validade cobrem os itens do Programa de Gerenciamento de Risco da Fauna (PGRF) e dos indicadores BAIST.

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

Depois confirme com `node -v` e `npm -v`. O Vue/Vite jÃƒÂƒÃ‚Â¡ vem como dependÃƒÂƒÃ‚Âªncia do projeto, entÃƒÂƒÃ‚Â£o nÃƒÂƒÃ‚Â£o ÃƒÂƒÃ‚Â© necessÃƒÂƒÃ‚Â¡rio instalar nada globalmente.

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

## 4.1 Stack completo (frontend + backend + banco)

O repositorio agora inclui Dockerfiles dedicados (`backend/Dockerfile`, `frontend/Dockerfile`) e um `docker-compose.yml` que sobe toda a stack em um unico comando:

```bash
# na raiz do repo
docker compose up -d --build
```

Servicos disponibilizados:

- **db**: Postgres 15 + PostGIS aplicando automaticamente `wildlife_full_package.sql` e `wildlife_extension.sql`. Porta exposta `5432`.
- **backend**: Fastify rodando em `http://localhost:3333`, conectado ao servico `db` e com `JWT_SECRET=supersegredo` (ajuste no `docker-compose.yml` se quiser outro segredo).
- **frontend**: build do Vite servido via Nginx em `http://localhost:8080`. O Nginx faz proxy de `/api` para o servico `backend`.

Para apontar o frontend para outro host/porta de API, informe `--build-arg VITE_API_URL="https://meu-host/api"` no servico `frontend` (ex.: `docker compose build frontend --build-arg VITE_API_URL=https://api.exemplo.com`).

Use `docker compose logs -f <servico>` para acompanhar cada container e finalize tudo com `docker compose down`. Para recriar o banco do zero, rode `docker compose down -v` e suba novamente.
## 5. Instalar dependencias do backend e frontend

As pastas `backend/` e `frontend/` possuem `package.json` separados. Rode os comandos abaixo uma ÃƒÂƒÃ‚Âºnica vez (ou apÃƒÂƒÃ‚Â³s atualizar dependÃƒÂƒÃ‚Âªncias) para instalar tudo que o Node precisa.

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

ApÃƒÂƒÃ‚Â³s instalar, use `npm run dev` dentro de cada pasta para subir os servidores em modo desenvolvimento.

## 6. Preparar banco manualmente (alternativa)

1. Criar banco `fauna` (ou outro nome e ajustar `.env`).
2. Aplicar o pacote: `psql -d fauna -f wildlife_full_package.sql`.
3. Confirmar que os schemas `wildlife` e `wildlife_kpi` foram criados e as funcoes PostGIS estao disponiveis.

### 6.1 Carga de dados ficticios (popular.sql)

O script `popular.sql` preenche automaticamente o ambiente de desenvolvimento com:

- 3 aeroportos ficticios, cada um com 20 locais operacionais.
- 30 movimentos por aeroporto (90 linhas), 30 avistamentos, 30 colisoes com custos/atraso, 30 acoes de controle e 30 atrativos.
- Cadastro minimo de especies utilizado pelos formularios e pelos relatorios.

Execute depois de aplicar o pacote principal/extensao:

```bash
psql -h localhost -U fauna_admin -d fauna -f popular.sql
```

Ou, se estiver usando o container criado via `Dockerfile.postgres`:

```bash
docker exec -i fauna-db psql -U fauna_admin -d fauna < popular.sql
```

> Observacao: o script nao faz TRUNCATE nas tabelas de fatos. Rode em um banco limpo ou apenas uma vez para evitar duplicar registros de teste.

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
| GET | `/api/relatorios/movimentos-periodo` | Totais mensais/anuais com variacao percentual contra anos adjacentes |
| GET | `/api/relatorios/colisoes-imagens` (`/export`) | Lista colisoes com miniaturas e exporta PDF/DOCX |
| GET | `/api/relatorios/incidentes/export` | Exporta em PDF/DOCX a analise de incidentes exibida no frontend |
| CRUD | `/api/inspecoes` | InspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes do sÃƒÂƒÃ‚Â­tio/ASA com observaÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes e quadrantes |
| CRUD | `/api/carcacas` | Registro de coleta/destino de carcaÃƒÂƒÃ‚Â§as |
| CRUD | `/api/auditorias-ambientais` | Auditorias de resÃƒÂƒÃ‚Â­duos, esgoto e sistemas de proteÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o |
| CRUD | `/api/asa-focos` | Focos atrativos na ASA com protocolos e follow-ups |
| CRUD | `/api/comunicados-externos` | OfÃƒÂƒÃ‚Â­cios, prazos e respostas de ÃƒÂƒÃ‚Â³rgÃƒÂƒÃ‚Â£os externos |
| CRUD | `/api/treinamentos-fauna` | SessÃƒÂƒÃ‚Âµes de treinamento realizadas |
| CRUD | `/api/pessoal` | Cadastro de pessoas por funÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o |
| CRUD | `/api/treinamentos-conclusoes` | ConclusÃƒÂƒÃ‚Âµes individuais com validade |
| GET | `/api/treinamentos/status` | Resumo de status por funÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o e pendÃƒÂƒÃ‚Âªncias prÃƒÂƒÃ‚Â³ximas |
| GET | `/api/analytics/financeiro` | Indicadores financeiros de colisÃƒÂƒÃ‚Âµes por ano/categoria |
| GET | `/api/analytics/incidentes` | DistribuiÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes avanÃƒÂƒÃ‚Â§adas por ano, espÃƒÂƒÃ‚Â©cie, tipo e dano |
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
3. **Avistamentos**: filtro por aeroporto/data, CRUD e integracao com itens; formulÃƒÂƒÃ‚Â¡rio usa selects para locais/equipes cadastrados e permite editar registros diretamente na tabela.
4. **Colisoes**: filtro por fase e formulario completo (quadrante + mapa, latitude/longitude, upload multiplo com previews, custos direto/indireto/outros, flag e minutos de atraso de voo, URLs externas).
5. **Acoes de Controle**: cadastro e painel rapido de BA espacial (chama `/api/kpis/ba-espacial`).
6. **Atrativos**: status (ativo/mitigando/resolvido) com formulario dedicado.
7. **Cadastros**: manutencao basica de aeroportos, especies, locais operacionais e equipes (CRUD completo por aeroporto), garantindo que avistamentos/colisoes usem IDs vÃƒÂƒÃ‚Â¡lidos.
8. **Inspecoes/ASA**: concentra inspeÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes do sÃƒÂƒÃ‚Â­tio/ASA, coleta de carcaÃƒÂƒÃ‚Â§as e auditorias ambientais com formulÃƒÂƒÃ‚Â¡rios orientados.
9. **Governanca**: painel ÃƒÂƒÃ‚Âºnico para focos ASA, comunicados externos, gestÃƒÂƒÃ‚Â£o de treinamentos, cadastro de pessoal e status automÃƒÂƒÃ‚Â¡tico de validade por funÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Â£o.
10. **Relatorios**: agrega indicadores financeiros (custos direto/indireto/outros), analise de incidentes (listas + export PDF/DOCX), comparativo de movimentos (grafico + tabela mensal com variacao %) e o relatorio de colisoes com imagens/miniaturas.
11. **Usuarios**: cadastro de usuÃƒÂƒÃ‚Â¡rios do sistema, aeroportos permitidos e reset de senha padrÃƒÂƒÃ‚Â£o.

Cada modulo possui sua rota no Vue Router, evitando concentrar todos os CRUDs em uma unica pagina conforme solicitado.

## 11. Relatorios e KPIs

- `GET /api/kpis/resumo`: combina `v_movements_daily`, `v_strikes_daily`, `v_sightings_effort_daily` e massa por especie para entregar SR/10k, taxa de dano, TAH, severidade, identificacao e massa real por 1M movimentos.
- `POST /api/kpis/did`: chama `wildlife_kpi.kpi_did_sr10k` para comparar locais controle vs tratamento.
- `POST /api/kpis/ba-espacial`: utiliza `wildlife_kpi.kpi_ba_spatial` e retorna SR, limites e taxa de avistamentos antes/depois por buffer.
- `GET /api/relatorios/*`: replicas das views `rpt_*` com periodo dinamico.
- `GET /api/relatorios/movimentos-periodo`: compara anos selecionados com os anos anteriores e retorna totais mensais/anuais (usa o mesmo payload da tabela/grafico do frontend).
- `GET /api/relatorios/colisoes-imagens` + `/export`: devolve a grade com miniaturas e gera PDF/DOCX a partir dos blobs salvos no banco.
- `GET /api/relatorios/incidentes/export`: exporta a analise de incidentes (ano/categoria/especie/fase/tipo) em PDF ou DOCX.
- `GET /api/analytics/financeiro`: agrega custos de colisÃƒÂƒÃ‚Âµes (diretos, indiretos, outros) por ano, categoria taxonÃƒÂƒÃ‚Â´mica, tipo de incidente e dano.
- `GET /api/analytics/incidentes`: distribuiÃƒÂƒÃ‚Â§ÃƒÂƒÃ‚Âµes complementares (ano, categoria, espÃƒÂƒÃ‚Â©cie, fase de voo, tipo de incidente) para anÃƒÂƒÃ‚Â¡lises exigidas pelos manuais.

## 12. Testes e proximos passos

- Adicionar testes automatizados (Vitest para Vue e supertest para Fastify) validando principais fluxos.
- Implementar autenticacao/perfis para auditar alteracoes.
- Evoluir formularios de colisoes/avistamentos com componentes especificos para itens, upload de fotos e geolocalizacao.
- Criar dashboards adicionais usando `kpi_ba_sr_tah` e mapas (Leaflet ou Mapbox).




