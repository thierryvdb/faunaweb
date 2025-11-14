#!/usr/bin/env node

/**
 * Script de verificação do ambiente
 * Verifica se tudo está configurado corretamente para rodar o projeto
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Verificando configuração do projeto...\n');

let hasErrors = false;

// 1. Verificar versão do Node.js
console.log('1️⃣  Verificando Node.js...');
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);

if (majorVersion >= 20) {
  console.log(`   ✅ Node.js v${nodeVersion} (OK)`);
} else {
  console.error(`   ❌ Node.js v${nodeVersion} (Requer >= 20.0.0)`);
  console.error('      Atualize: https://nodejs.org/');
  hasErrors = true;
}

// 2. Verificar npm
console.log('\n2️⃣  Verificando npm...');
const npmVersion = require('child_process')
  .execSync('npm --version')
  .toString()
  .trim();
console.log(`   ✅ npm v${npmVersion}`);

// 3. Verificar node_modules
console.log('\n3️⃣  Verificando dependências...');
const nodeModulesPath = path.join(__dirname, 'node_modules');

if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✅ node_modules existe');

  // Verificar pacotes principais
  const requiredPackages = [
    'fastify',
    '@fastify/cors',
    '@fastify/jwt',
    '@fastify/multipart',
    'pg',
    'zod'
  ];

  let missingPackages = [];
  for (const pkg of requiredPackages) {
    const pkgPath = path.join(nodeModulesPath, pkg);
    if (!fs.existsSync(pkgPath)) {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length > 0) {
    console.error('   ❌ Pacotes faltando:', missingPackages.join(', '));
    console.error('      Execute: npm install');
    hasErrors = true;
  } else {
    console.log('   ✅ Todos os pacotes principais instalados');
  }

  // Verificar versão do Fastify
  try {
    const fastifyPkg = require('./node_modules/fastify/package.json');
    const fastifyVersion = fastifyPkg.version;
    const fastifyMajor = parseInt(fastifyVersion.split('.')[0]);

    if (fastifyMajor >= 5) {
      console.log(`   ✅ Fastify v${fastifyVersion} (OK)`);
    } else {
      console.error(`   ❌ Fastify v${fastifyVersion} (Requer >= 5.0.0)`);
      console.error('      Execute: npm install');
      hasErrors = true;
    }
  } catch (error) {
    console.error('   ❌ Não foi possível verificar versão do Fastify');
    hasErrors = true;
  }
} else {
  console.error('   ❌ node_modules não encontrado');
  console.error('      Execute: npm install');
  hasErrors = true;
}

// 4. Verificar arquivo .env
console.log('\n4️⃣  Verificando arquivo .env...');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  console.log('   ✅ Arquivo .env existe');

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const requiredVars = ['JWT_SECRET'];
  const missingVars = [];

  for (const varName of requiredVars) {
    if (!envContent.includes(varName)) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.warn('   ⚠️  Variáveis faltando:', missingVars.join(', '));
  }

  // Verificar configuração de banco de dados
  const hasDbUrl = envContent.includes('DATABASE_URL');
  const hasPgVars = envContent.includes('PGHOST') &&
                    envContent.includes('PGDATABASE');

  if (!hasDbUrl && !hasPgVars) {
    console.error('   ❌ Configuração de banco de dados faltando');
    console.error('      Configure DATABASE_URL ou PGHOST/PGDATABASE');
    hasErrors = true;
  } else {
    console.log('   ✅ Configuração de banco de dados presente');
  }
} else {
  console.error('   ❌ Arquivo .env não encontrado');
  console.error('      Copie .env.example ou crie um novo .env');
  hasErrors = true;
}

// 5. Verificar arquivos TypeScript
console.log('\n5️⃣  Verificando arquivos do projeto...');
const requiredFiles = [
  'src/server.ts',
  'src/app.ts',
  'src/routes/index.ts',
  'tsconfig.json'
];

let missingFiles = [];
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('   ❌ Arquivos faltando:', missingFiles.join(', '));
  hasErrors = true;
} else {
  console.log('   ✅ Todos os arquivos principais presentes');
}

// Resumo final
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.error('\n❌ CONFIGURAÇÃO INCOMPLETA\n');
  console.error('Corrija os erros acima antes de executar npm run dev\n');
  process.exit(1);
} else {
  console.log('\n✅ TUDO PRONTO!\n');
  console.log('Execute: npm run dev\n');
  process.exit(0);
}
