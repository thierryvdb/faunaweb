#!/bin/bash

# Script para configurar Node.js 20+ e reinstalar dependências

echo "=== Verificando versão atual do Node.js ==="
node --version

CURRENT_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$CURRENT_NODE_VERSION" -lt 20 ]; then
    echo ""
    echo "⚠️  Node.js $CURRENT_NODE_VERSION detectado. Este projeto requer Node.js 20+"
    echo ""
    echo "Por favor, atualize o Node.js seguindo as instruções em UPGRADE_NODE.md"
    echo ""
    echo "Opções rápidas:"
    echo "  1. Usando nvm: nvm install 20 && nvm use 20"
    echo "  2. Baixar em: https://nodejs.org/"
    exit 1
else
    echo "✓ Node.js $CURRENT_NODE_VERSION está OK (>= 20)"
fi

echo ""
echo "=== Limpando instalação anterior ==="
rm -rf node_modules package-lock.json
echo "✓ node_modules e package-lock.json removidos"

echo ""
echo "=== Instalando dependências ==="
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Instalação concluída com sucesso!"
    echo ""
    echo "Dependências instaladas:"
    npm list --depth=0 | grep -E "(fastify|@fastify)"
    echo ""
    echo "Execute 'npm run dev' para iniciar o servidor"
else
    echo ""
    echo "❌ Erro durante a instalação"
    exit 1
fi
