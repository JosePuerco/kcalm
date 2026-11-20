# Kcalm als Container auf dem Pi (kcalm-web), gebaut von scripts/deploy.ts.
# Stufe 1 baut die App mit Node, Stufe 2 liefert nur die fertigen Dateien mit nginx aus.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stabiler Zweig 1.30: jeder Deploy baut neu und bekommt so Sicherheits-Updates innerhalb des Zweigs
FROM nginx:1.30-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Gesund = nginx antwortet; das Deploy-Skript wartet auf diesen Zustand
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
