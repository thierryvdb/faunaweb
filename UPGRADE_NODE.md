# Upgrade Node.js para versão 20+

O projeto agora requer Node.js 20 ou superior para usar as versões mais recentes do Fastify.

## No Ubuntu/Linux (usando nvm - recomendado):

```bash
# Instalar/atualizar nvm (se ainda não tiver)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Recarregar o shell
source ~/.bashrc

# Instalar Node.js 20 LTS
nvm install 20

# Usar Node.js 20 como padrão
nvm use 20
nvm alias default 20

# Verificar a versão
node --version  # Deve mostrar v20.x.x
```

## Alternativa: Usando apt (Ubuntu/Debian):

```bash
# Adicionar repositório NodeSource para Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js 20
sudo apt-get install -y nodejs

# Verificar a versão
node --version  # Deve mostrar v20.x.x
```

## Após atualizar o Node.js:

```bash
# No diretório backend
cd ~/faunaweb/backend

# Remover node_modules e package-lock antigos
rm -rf node_modules package-lock.json

# Reinstalar dependências
npm install

# Executar o servidor
npm run dev
```

## Verificar versões atuais:

- Fastify: 5.2.0+
- @fastify/cors: 10.0.1+
- @fastify/jwt: 10.0.0+
- @fastify/multipart: 9.0.1+
- fastify-plugin: 5.0.1+

Todas essas versões requerem Node.js 20+.
