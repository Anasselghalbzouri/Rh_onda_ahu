# Frontend — build React (Vite), servi en statique par nginx.
# ------- Étape 1 : build -------
FROM node:22-alpine AS build
WORKDIR /app

# Dépendances d'abord (cache) — npm ci exige package-lock.json
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Code source + build de production -> /app/build
COPY frontend/ ./
RUN npm run build

# ------- Étape 2 : service statique -------
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
