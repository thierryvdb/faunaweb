# 🚀 Passos para Atualização - Node.js 20+ e Fastify 5.x

## ✅ O que foi feito

### 1. Arquivos Modificados
- ✅ `backend/package.json` - Versões atualizadas para Fastify 5.x
- ✅ `backend/src/routes/index.ts` - Sistema de rotas simplificado
- ✅ Adicionado script de verificação de versão do Node.js

### 2. Arquivos Criados
- ✅ `backend/.nvmrc` - Define Node.js 20 como versão padrão
- ✅ `backend/README.md` - Documentação completa
- ✅ `backend/setup-node20.sh` - Script automatizado de setup
- ✅ `UPGRADE_NODE.md` - Instruções de upgrade
- ✅ `CHANGELOG_FASTIFY.md` - Log detalhado de mudanças

### 3. Versões Atualizadas

| Pacote | Versão Antiga | Versão Nova | Requer Node |
|--------|---------------|-------------|-------------|
| fastify | 4.x | **5.2.0+** | 20+ |
| @fastify/cors | 9.x | **10.0.1+** | 20+ |
| @fastify/jwt | 8.x | **10.0.0+** | 20+ |
| @fastify/multipart | 8.x | **9.0.1+** | 20+ |
| fastify-plugin | 4.x | **5.0.1+** | 20+ |

## 🎯 Próximos Passos (NO UBUNTU/SERVIDOR)

### Passo 1: Atualizar Node.js

**Opção A - Usando nvm (RECOMENDADO):**

```bash
# Instalar nvm se não tiver
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Instalar Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Confirmar versão
node --version  # Deve mostrar v20.x.x
```

**Opção B - Usando apt (Ubuntu/Debian):**

```bash
# Adicionar repositório NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar
sudo apt-get install -y nodejs

# Confirmar versão
node --version  # Deve mostrar v20.x.x
```

**Opção C - Baixar diretamente:**

Acesse: https://nodejs.org/ e baixe a versão LTS 20.x

### Passo 2: Atualizar o Repositório

```bash
# Ir para o diretório do projeto
cd ~/faunaweb

# Atualizar do repositório Git
git pull origin main
```

### Passo 3: Reinstalar Dependências do Backend

**Opção A - Usando o script automatizado:**

```bash
cd ~/faunaweb/backend
chmod +x setup-node20.sh
./setup-node20.sh
```

**Opção B - Manual:**

```bash
cd ~/faunaweb/backend

# Verificar versão do Node.js
npm run check-node

# Limpar instalação anterior
rm -rf node_modules package-lock.json

# Reinstalar
npm install

# Verificar versões instaladas
npm list fastify @fastify/cors @fastify/jwt
```

### Passo 4: Testar o Servidor

```bash
# Iniciar em modo desenvolvimento
npm run dev

# Deve mostrar:
# ✓ Server listening at http://0.0.0.0:3333
```

### Passo 5: Verificar Funcionamento

```bash
# Em outro terminal, testar endpoint de status
curl http://localhost:3333/status

# Deve retornar:
# {"mensagem":"API operacional"}
```

## 🔍 Verificações

### 1. Versão do Node.js
```bash
node --version
# Esperado: v20.x.x ou superior
```

### 2. Versões dos Pacotes
```bash
cd ~/faunaweb/backend
npm list --depth=0 | grep fastify
```

Esperado:
```
├── @fastify/cors@10.x.x
├── @fastify/jwt@10.x.x
├── @fastify/multipart@9.x.x
├── fastify-plugin@5.x.x
└── fastify@5.x.x
```

### 3. TypeScript Compilando
```bash
npm run lint
# Não deve mostrar erros
```

### 4. Servidor Rodando
```bash
npm run dev
# Deve iniciar sem erros
```

## 🐛 Troubleshooting

### Problema: Node.js ainda mostra versão antiga

```bash
# Verificar qual Node está sendo usado
which node

# Se usando nvm, garantir que está ativo
nvm use 20
nvm alias default 20

# Reabrir terminal
source ~/.bashrc
```

### Problema: Erro "Cannot find module"

```bash
cd ~/faunaweb/backend
rm -rf node_modules package-lock.json
npm install
```

### Problema: Erro de permissão no npm

```bash
# Corrigir permissões
sudo chown -R $USER:$USER ~/faunaweb/backend/node_modules
```

### Problema: Porta 3333 já em uso

```bash
# Encontrar processo usando a porta
lsof -i :3333

# Matar processo (substitua PID)
kill -9 <PID>

# Ou alterar porta no .env
echo "PORT=3334" >> .env
```

## 📊 Checklist Final

Antes de considerar a atualização completa:

- [ ] Node.js versão 20+ instalado
- [ ] Repositório atualizado (git pull)
- [ ] Dependências reinstaladas
- [ ] `npm run check-node` passa
- [ ] `npm run lint` não mostra erros
- [ ] `npm run dev` inicia sem erros
- [ ] Endpoint `/status` responde
- [ ] Login funciona
- [ ] Rotas protegidas exigem autenticação

## 🎉 Sucesso!

Se todos os passos acima foram completados:

1. ✅ Projeto atualizado para Fastify 5.x
2. ✅ Node.js 20+ funcionando
3. ✅ Dependências compatíveis
4. ✅ Servidor rodando corretamente

## 📞 Suporte

Se encontrar problemas:

1. Consulte `backend/README.md` para documentação completa
2. Verifique `CHANGELOG_FASTIFY.md` para detalhes técnicos
3. Execute `./setup-node20.sh` para setup automatizado
4. Verifique logs do servidor para erros específicos

---

**Nota**: Esta atualização é **obrigatória** pois o Fastify 5.x não funciona com Node.js 18.
