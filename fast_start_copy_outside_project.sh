#!/bin/bash
# This script sets up the faunaweb project, including database and services.

# Set script to exit immediately if any command fails
set -e

echo "--- Navigating to home directory ---"
cd ~

echo "--- Removing old faunaweb project directory (if it exists) ---"
rm -rf faunaweb

echo "--- Cloning the project ---"
# Clones the repo into a new directory named 'faunaweb' in the home folder
git clone https://github.com/thierryvdb/faunaweb.git

echo "--- Navigating into project directory ---"
cd faunaweb

echo "--- Stopping and removing old fauna-db container (if it exists) ---"
# Use '|| true' to prevent script from failing if container doesn't exist
docker stop fauna-db || true
docker rm fauna-db || true

echo "--- Building new fauna-db Docker image ---"
# Build using the Dockerfile.postgres in the current directory (.)
docker build -t fauna-db -f Dockerfile.postgres .

echo "--- Running new fauna-db container ---"
docker run -d --name fauna-db -p 5432:5432 fauna-db

echo "--- Waiting for database to initialize (10 seconds) ---"
sleep 10
docker logs fauna-db

echo "--- Killing existing backend process (if any) ---"
# Mata o processo usando a porta 3333 (porta padrão do backend)
fuser -k 3333/tcp || true
sleep 2 # Pequena pausa para liberar a porta

echo "--- Initiating backend ---"
cd backend/
npm install
# Start backend in the background
npm run dev &
cd ..

echo "--- Killing existing frontend process (if any) ---"
# Mata o processo usando a porta 5173 (porta do frontend)
fuser -k 5173/tcp || true
sleep 2 # Pequena pausa para liberar a porta

echo "--- Initiating frontend ---"
cd frontend/
npm install
# Adiciona permissão de execução ao binário do vite
chmod +x node_modules/.bin/vite
# Start frontend in the background
npm run dev -- --host 0.0.0.0 --port 5173 &
cd ..

echo "--- Setup complete! Backend and Frontend are starting. ---"