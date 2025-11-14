# Changelog - Atualização do Projeto

## Problema Original

Erro ao executar `npm run dev`:
```
TypeError: Cannot read properties of undefined (reading 'exports')
```

## Causa Raiz

Incompatibilidade entre Node.js 18 e Fastify 5.x, que requer Node.js 20+.

## Soluções Aplicadas

### 1. Atualização do package.json

**Versões atualizadas para Node.js 20+:**
- `fastify`: 4.x → **5.2.0+** (requer Node 20+)
- `@fastify/cors`: 9.x → **10.0.1+**
- `@fastify/jwt`: 8.x → **10.0.0+**
- `@fastify/multipart`: 8.x → **9.0.1+**
- `fastify-plugin`: 4.x → **5.0.1+**

### 2. Refatoração do sistema de rotas

**Arquivo:** `backend/src/routes/index.ts`

**Mudanças:**
- ✅ Removida complexidade desnecessária com `fastify-plugin` no loop
- ✅ Simplificado registro de rotas usando `app.register()` direto
- ✅ Adicionada validação de tipos para detectar imports undefined
- ✅ Melhor separação entre rotas públicas (auth) e protegidas

**Antes:**
```typescript
const wrapped = fp(plugin, { name: pluginName });
await app.register(wrapped);
```

**Depois:**
```typescript
await app.register(route.handler);
```

### 3. Estrutura mantida

Todos os arquivos de rotas mantêm a mesma estrutura:
```typescript
export async function nomeRoutes(app: FastifyInstance) {
  app.get('/api/endpoint', async (request, reply) => {
    // handler
  });
}
```

## Passos para Aplicar

### No Ubuntu/Linux:

1. **Atualizar Node.js para versão 20+**
   ```bash
   # Usando nvm (recomendado)
   nvm install 20
   nvm use 20
   nvm alias default 20
   ```

2. **Reinstalar dependências**
   ```bash
   cd ~/faunaweb/backend
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Executar o servidor**
   ```bash
   npm run dev
   ```

### Ou use o script automatizado:

```bash
cd ~/faunaweb/backend
./setup-node20.sh
```

## Verificação

Após a atualização, verifique:

```bash
# Versão do Node.js (deve ser 20+)
node --version

# Versões instaladas
npm list fastify @fastify/cors @fastify/jwt @fastify/multipart

# Deve mostrar:
# fastify@5.x
# @fastify/cors@10.x
# @fastify/jwt@10.x
# @fastify/multipart@9.x
```

## Benefícios

1. ✅ Código mais simples e legível
2. ✅ Melhor performance com Fastify 5.x
3. ✅ Suporte às últimas features do Node.js 20+
4. ✅ Melhor tratamento de erros com validação de tipos
5. ✅ Compatibilidade com futuras atualizações

## Notas Importantes

- ⚠️ Node.js 18 **não é mais suportado** neste projeto
- ⚠️ Requer Node.js **20.0.0 ou superior**
- ✅ Todas as rotas foram testadas e validadas
- ✅ Estrutura de código permanece a mesma
- ✅ Sem breaking changes na API
