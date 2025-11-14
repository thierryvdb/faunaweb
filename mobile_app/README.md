# Fauna Mobile (Ionic + Capacitor + Vue 3)

Aplicativo híbrido pensado para tablets e smartphones que concentra as operações de campo mais críticas do sistema Fauna:

- Painel resumido com indicadores por aeroporto.
- Registro simplificado de Inspeções/ASA.
- Registro de Atrativos na ASA com captura de GPS.
- Registro de Ações de Controle (incluindo informações de eficácia).
- Registro de Avistamentos com suporte a múltiplas espécies, foto via câmera e localização.

## Pré‑requisitos

- Node.js **20+** (necessário para as dependências do Capacitor 7).
- npm 9+.
- Android Studio (para gerar/aprovar o APK).

## Variáveis de ambiente

Crie um arquivo `.env` (ou `.env.local`) dentro de `mobile_app/` definindo a URL pública do backend:

```env
VITE_API_URL=https://seu-backend:3333
```

## Scripts principais

```bash
# Instalar dependências
npm install

# Executar no navegador/dispositivo (modo desenvolvimento)
npm run dev

# Validar build web
npm run build && npm run preview

# Sincronizar web assets com plataformas nativas
npm run cap:sync

# Abrir projeto Android no Android Studio (após um build)
npm run cap:android

# Gerar APK via Capacitor (Android)
npm run android
```

> ⚠️ A primeira sincronização (`npm run cap:sync`) cria as pastas `android/` e/ou `ios/`. Caso esteja usando um Node.js inferior a 20, atualize antes de rodar este comando para evitar falhas.

## Fluxo sugerido para gerar um APK

1. Ajustar `VITE_API_URL` para apontar para o backend disponível.
2. `cd mobile_app && npm install` (apenas uma vez).
3. `npm run build` para gerar os assets.
4. `npm run cap:sync` para copiar assets e dependências web para o projeto nativo.
5. `npm run cap:android` para abrir o projeto no Android Studio e assinar/gerar o APK.

## Próximos passos

- Implementar login e sincronização offline (armazenar token usando Capacitor Preferences).
- Sincronizar listas auxiliares (espécies, locais etc.) com cache persistente para uso offline.
- Habilitar push notifications e atualizações OTA conforme a política da organização.
