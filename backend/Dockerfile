# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

# Sharp e outros pacotes nativos precisam de toolchain durante o build
# Canvas precisa de Cairo e suas dependências
RUN apk add --no-cache python3 make g++ \
    pkg-config \
    cairo-dev \
    pango-dev \
    pixman-dev \
    jpeg-dev \
    giflib-dev

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build

# remove dependências de desenvolvimento antes de gerar a imagem final
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies for canvas
RUN apk add --no-cache \
    cairo \
    pango \
    pixman \
    jpeg \
    giflib

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3333

CMD ["node", "dist/server.js"]
