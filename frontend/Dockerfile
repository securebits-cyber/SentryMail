# Produktions-Image: das Frontend wird gebaut und danach als statische Dateien
# ausgeliefert. Im laufenden Container liegt kein Quelltext und kein Devserver -
# der Vite-Devserver (Dockerfile.dev) gehoert ausschliesslich in die Entwicklung,
# weil er /src im Klartext ausliefert und jeden Ladefehler per HMR-WebSocket an
# alle verbundenen Browser meldet.
FROM node:24-alpine AS build

WORKDIR /app

# Reproduzierbare Installation aus dem Lockfile.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite loest import.meta.env.* zur Bauzeit auf. Die Werte muessen also hier
# schon feststehen und lassen sich spaeter nicht mehr per Container-Umgebung
# aendern - docker-compose.yml reicht sie aus der .env als build args herein.
ARG VITE_API_URL=/api
ARG VITE_WIKI_URL=
ARG VITE_SUPPORT_EMAIL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WIKI_URL=$VITE_WIKI_URL \
    VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL

RUN npm run build

FROM caddy:2-alpine

COPY --from=build /app/dist /srv
COPY Caddyfile.static /etc/caddy/Caddyfile

# Gleicher Port wie beim Devserver, damit der Haupt-Caddy in beiden Betriebsarten
# dieselbe Zieladresse hat (siehe Caddyfile: reverse_proxy frontend:5173).
EXPOSE 5173
