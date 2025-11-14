# 🚀 Início Rápido - Fauna Backend

## ⚡ Setup em 3 Passos (Ubuntu/Linux)

### 1️⃣ Atualizar Node.js para versão 20+

```bash
# Usando nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

### 2️⃣ Atualizar e Instalar Dependências

```bash
cd ~/faunaweb/backend
git pull origin main
rm -rf node_modules package-lock.json
npm install
```

### 3️⃣ Iniciar o Servidor

```bash
npm run dev
```

---

## 🔧 Alternativa: Script Automatizado

```bash
cd ~/faunaweb/backend
chmod +x setup-node20.sh
./setup-node20.sh
npm run dev
```

---

## ✅ Verificação Rápida

```bash
# Verificar Node.js
node --version  # Deve ser v20.x.x ou superior

# Verificar dependências
npm run check

# Verificar apenas Node.js
npm run check-node
```

---

## 🆘 Problemas?

### Node.js ainda está < 20

```bash
nvm install 20
nvm use 20
nvm alias default 20
source ~/.bashrc
```

### Erro "Cannot find module"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erro de banco de dados

Verifique o arquivo `.env`:
```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/fauna
JWT_SECRET=seu_secret_aqui
```

---

## 📚 Documentação Completa

- **README.md** - Documentação completa do backend
- **PASSOS_ATUALIZACAO.md** - Guia detalhado de atualização
- **CHANGELOG_FASTIFY.md** - O que mudou tecnicamente
- **UPGRADE_NODE.md** - Como atualizar o Node.js

---

## 🎯 Requisitos Mínimos

- ✅ Node.js >= 20.0.0
- ✅ npm >= 9.0.0
- ✅ PostgreSQL >= 12
- ✅ Arquivo .env configurado

---

## 🏁 Teste Final

Após iniciar com `npm run dev`, teste:

```bash
curl http://localhost:3333/status
# Deve retornar: {"mensagem":"API operacional"}
```

Pronto! 🎉
