# Fauna Backend API

API backend para sistema de gestão de fauna aeroportuária, construída com Fastify 5.x.

## 📋 Requisitos

- **Node.js**: >= 20.0.0 (obrigatório)
- **npm**: >= 9.0.0
- **PostgreSQL**: >= 12
- **Sistema operacional**: Linux, macOS, Windows

## 🚀 Instalação

### 1. Verificar versão do Node.js

```bash
node --version
# Deve retornar v20.x.x ou superior
```

Se você tem uma versão inferior, atualize:

**Usando nvm (recomendado):**
```bash
nvm install 20
nvm use 20
nvm alias default 20
```

**Ou baixe diretamente:**
- https://nodejs.org/ (versão LTS 20.x)

### 2. Verificar compatibilidade

```bash
npm run check-node
```

### 3. Instalar dependências

```bash
npm install
```

### 4. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3333

# Banco de dados (opção 1: connection string)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/fauna

# Ou (opção 2: parâmetros individuais)
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=sua_senha
PGDATABASE=fauna

# JWT
JWT_SECRET=seu_segredo_jwt_aqui
```

## 🏃 Executando

### Modo desenvolvimento (com hot reload)

```bash
npm run dev
```

### Build para produção

```bash
npm run build
npm start
```

### Verificar tipos TypeScript

```bash
npm run lint
```

## 📦 Dependências Principais

- **Fastify**: 5.2.0+ (framework web)
- **@fastify/cors**: 10.0.1+ (CORS)
- **@fastify/jwt**: 10.0.0+ (autenticação JWT)
- **@fastify/multipart**: 9.0.1+ (upload de arquivos)
- **pg**: 8.11.3+ (PostgreSQL client)
- **zod**: 3.23.8+ (validação de schemas)

## 🏗️ Estrutura do Projeto

```
backend/
├── src/
│   ├── app.ts              # Configuração do Fastify
│   ├── server.ts           # Entry point
│   ├── config/
│   │   └── env.ts          # Variáveis de ambiente
│   ├── services/
│   │   └── db.ts           # Cliente PostgreSQL
│   ├── routes/
│   │   ├── index.ts        # Registro de rotas
│   │   ├── auth.ts         # Autenticação
│   │   ├── airports.ts     # Aeroportos
│   │   ├── species.ts      # Espécies
│   │   ├── sightings.ts    # Avistamentos
│   │   ├── strikes.ts      # Colisões
│   │   └── ...             # Outras rotas
│   ├── types/
│   │   └── fastify.d.ts    # Type definitions
│   └── utils/
│       └── auth.ts         # Utilidades de auth
├── dist/                   # Build output (gerado)
├── package.json
├── tsconfig.json
└── .env                    # Variáveis de ambiente (não versionado)
```

## 🔐 Autenticação

A API usa JWT para autenticação. Rotas protegidas requerem o header:

```
Authorization: Bearer <token>
```

### Endpoints públicos:
- `POST /api/auth/login`
- `GET /status`

### Endpoints protegidos:
- Todos os outros endpoints em `/api/*` requerem autenticação

## 🐛 Troubleshooting

### Erro: "Cannot read properties of undefined (reading 'exports')"

**Causa**: Node.js versão < 20

**Solução**:
```bash
# Atualizar Node.js para versão 20+
nvm install 20
nvm use 20

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Cannot find module"

**Solução**:
```bash
npm install
```

### Erro de conexão com banco de dados

**Verifique**:
1. PostgreSQL está rodando
2. Credenciais no `.env` estão corretas
3. Banco de dados `fauna` existe
4. Usuário tem permissões adequadas

### Script de verificação automática

Use o script fornecido:
```bash
./setup-node20.sh
```

## 📝 Scripts Disponíveis

- `npm run dev` - Inicia servidor em modo desenvolvimento com hot reload
- `npm run build` - Compila TypeScript para JavaScript
- `npm start` - Inicia servidor em produção (requer build)
- `npm run lint` - Verifica tipos TypeScript
- `npm run check-node` - Verifica versão do Node.js

## 🔄 Atualizações Recentes

- ✅ Atualizado para Fastify 5.x
- ✅ Requer Node.js 20+
- ✅ Sistema de rotas simplificado
- ✅ Melhor validação de tipos
- ✅ Verificação automática de versão do Node.js

Ver [CHANGELOG_FASTIFY.md](../CHANGELOG_FASTIFY.md) para mais detalhes.

## 📄 Licença

Privado - Todos os direitos reservados
