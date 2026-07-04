# PhishAware – Projekt-Struktur & Dateiendstand

**Ziel:** Du weißt genau, welche Dateien wo sein müssen, bevor du Docker startest.

---

## Komplette Verzeichnis-Struktur

```
phishaware/
│
├── backend/                          # Python/FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # 🔴 NOCH ZU ERSTELLEN
│   │   ├── config.py                # 🔴 NOCH ZU ERSTELLEN
│   │   ├── database.py              # 🔴 NOCH ZU ERSTELLEN
│   │   ├── models.py                # ✅ (aus Database-Schema Doc)
│   │   ├── schemas.py               # 🔴 NOCH ZU ERSTELLEN
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── oidc.py              # 🔴 NOCH ZU ERSTELLEN
│   │   │   └── permissions.py       # 🔴 NOCH ZU ERSTELLEN
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── campaigns.py         # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── templates.py         # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── results.py           # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── health.py            # 🔴 NOCH ZU ERSTELLEN
│   │   │   └── tracking.py          # ✅ (aus SMTP-Config Doc)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── mail.py              # ✅ (aus SMTP-Config Doc)
│   │   │   ├── campaign.py          # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── template.py          # 🔴 NOCH ZU ERSTELLEN
│   │   │   └── tracking.py          # 🔴 NOCH ZU ERSTELLEN
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── security.py          # 🔴 NOCH ZU ERSTELLEN
│   │       └── logging.py           # 🔴 NOCH ZU ERSTELLEN
│   │
│   ├── alembic/                     # Database Migrations
│   │   ├── versions/
│   │   │   └── 001_initial_schema.py
│   │   ├── env.py
│   │   └── alembic.ini
│   │
│   ├── migrations/                  # (Alternative zu alembic)
│   │   └── 001_init.sql
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_campaigns.py        # 🔴 SPÄTER
│   │   ├── test_auth.py             # 🔴 SPÄTER
│   │   └── test_mail.py             # 🔴 SPÄTER
│   │
│   ├── requirements.txt             # ✅ (siehe unten)
│   ├── Dockerfile                   # ✅ (siehe unten)
│   ├── .env.example                 # ✅ (siehe unten)
│   ├── .env                         # 🔴 (Du erstellst manuell!)
│   └── .gitignore
│
├── frontend/                        # React/Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx           # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── CampaignForm.tsx     # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── Dashboard.tsx        # 🔴 NOCH ZU ERSTELLEN
│   │   │   └── ResultsTable.tsx     # 🔴 NOCH ZU ERSTELLEN
│   │   ├── pages/
│   │   │   ├── index.tsx            # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── campaigns.tsx        # 🔴 NOCH ZU ERSTELLEN
│   │   │   ├── login.tsx            # 🔴 NOCH ZU ERSTELLEN
│   │   │   └── results.tsx          # 🔴 NOCH ZU ERSTELLEN
│   │   ├── services/
│   │   │   ├── api.ts               # 🔴 NOCH ZU ERSTELLEN
│   │   │   └── auth.ts              # 🔴 NOCH ZU ERSTELLEN
│   │   ├── App.tsx                  # 🔴 NOCH ZU ERSTELLEN
│   │   └── main.tsx                 # 🔴 NOCH ZU ERSTELLEN
│   │
│   ├── public/
│   │   └── vite.svg
│   │
│   ├── package.json                 # ✅ (siehe unten)
│   ├── vite.config.ts               # ✅ (siehe unten)
│   ├── tsconfig.json                # ✅ (siehe unten)
│   ├── Dockerfile.dev               # ✅ (siehe unten)
│   ├── .env.example                 # ✅ (siehe unten)
│   └── .gitignore
│
├── docs/                            # Dokumentation
│   ├── phishing-awareness-open-core-konzept.md
│   ├── phishing-awareness-architektur.md
│   ├── phishing-awareness-development-setup.md
│   ├── phishing-awareness-database-schema.md
│   ├── phishing-awareness-smtp-konfiguration.md
│   ├── phishing-awareness-ionos-quick-setup.md
│   └── phishing-awareness-setup-anfaenger.md
│
├── nginx.conf                       # ✅ (siehe unten)
├── docker-compose.yml               # ✅ (siehe unten)
├── .gitignore                       # ✅ (siehe unten)
├── Makefile                         # 🔴 OPTIONAL
├── LICENSE                          # AGPL-3.0
└── README.md                        # 🔴 NOCH ZU ERSTELLEN
```

---

## Status: Was du SOFORT brauchst vs. SPÄTER

### 🟢 **SOFORT brauchst du diese Dateien** (zum Docker starten)

#### 1. `backend/requirements.txt`
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
alembic==1.12.1
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
python-multipart==0.0.6
httpx==0.25.2
aioredis==2.0.1
redis==5.0.1
jinja2==3.1.2
python-dotenv==1.0.0
email-validator==2.1.0
authlib==1.3.0
aiosmtplib==3.0.1
cryptography==41.0.7
pytest==7.4.3
pytest-asyncio==0.21.1
black==23.12.0
ruff==0.1.8
```

#### 2. `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 3. `backend/.env.example` (Vorlage)
```bash
DATABASE_URL=postgresql://phishaware:phishaware123@postgres:5432/phishaware
REDIS_URL=redis://redis:6379
SECRET_KEY=dev-only-change-in-prod
AUTHENTIK_SERVER=https://auth.kao-baumann.de
AUTHENTIK_CLIENT_ID=phishaware-dev
AUTHENTIK_CLIENT_SECRET=your-secret
SMTP_HOST=smtp.ionos.de
SMTP_PORT=587
SMTP_USERNAME=noreply@kao-baumann.de
SMTP_PASSWORD=your-ionos-password
SMTP_FROM_EMAIL=noreply@kao-baumann.de
SMTP_FROM_NAME=PhishAware Training
LOG_LEVEL=DEBUG
```

#### 4. `backend/.env` (⚠️ DU ERSTELLST DIESE!)
```bash
# Kopiere von .env.example und fülle echte Werte ein!
# Diese Datei NICHT in Git committen (steht in .gitignore)
```

#### 5. `frontend/package.json`
```json
{
  "name": "phishaware-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "typescript": "^5.3.3"
  }
}
```

#### 6. `frontend/Dockerfile.dev`
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
```

#### 7. `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
  },
})
```

#### 8. `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### 9. `.gitignore`
```
# Environment
.env
.env.local
.env.*.local

# Backend
backend/__pycache__/
backend/*.egg-info
backend/dist/
backend/.pytest_cache/
backend/.coverage

# Frontend
frontend/node_modules/
frontend/dist/
frontend/.vite

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
*.log
```

#### 10. `docker-compose.yml`
(Aus dem Anfänger-Setup Dokument kopieren)

#### 11. `nginx.conf`
```nginx
user nginx;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:5173;
    }

    server {
        listen 80;
        server_name localhost;

        # Backend API
        location /api/ {
            proxy_pass http://backend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_http_version 1.1;
        }

        # Frontend
        location / {
            proxy_pass http://frontend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

---

### 🟡 **SPÄTER brauchst du diese Dateien** (Entwicklung mit Claude)

Diese erstellen wir zusammen via Claude AI Artifacts:

```
🔴 backend/app/main.py              → Claude Artifact 1
🔴 backend/app/config.py            → Claude Artifact 2
🔴 backend/app/database.py          → Claude Artifact 3
🔴 backend/app/models.py            → Claude Artifact 4 (oder aus DB-Schema Doc kopieren)
🔴 backend/app/schemas.py           → Claude Artifact 5
🔴 backend/app/auth/oidc.py         → Claude Artifact 6
🔴 backend/app/api/health.py        → Claude Artifact 7
🔴 backend/app/api/campaigns.py     → Claude Artifact 8
🔴 frontend/src/main.tsx            → Claude Artifact 9
🔴 frontend/src/App.tsx             → Claude Artifact 10
```

---

## Timeline: Was du WANN machst

### **Tag 1 (heute) – Setup vorbereiten (1 Stunde)**

```bash
# 1. Verzeichnis erstellen
mkdir ~/projects/phishaware
cd ~/projects/phishaware
git init

# 2. Dateien erstellen (Copy-Paste von oben)
mkdir -p backend/app/{auth,api,services,utils}
mkdir -p frontend/src/{components,pages,services}

# 3. Alle 🟢 Dateien von oben erstellen:
# - backend/requirements.txt
# - backend/Dockerfile
# - backend/.env.example
# - frontend/package.json
# - frontend/Dockerfile.dev
# - frontend/vite.config.ts
# - etc.
```

### **Tag 2 – Docker starten (30 Minuten)**

```bash
# 1. .env manuell erstellen (mit echten Werten)
cp backend/.env.example backend/.env
# → Editiere backend/.env mit realen Werten

# 2. Docker starten
docker-compose up -d

# 3. Testen
curl http://localhost:8000/health  # Sollte {}
curl http://localhost:5173/         # Sollte React HTML
```

### **Tag 3+ – Code mit Claude entwickeln**

```
Woche 1: Auth + Basic API
Woche 2: Campaign CRUD
Woche 3: Dashboard + Tracking
Woche 4: Integrations (GLPI, Wazuh)
```

---

## Quick-Copy: Alle Dateien erstellen (Bash-Script)

Wenn du alles auf einmal erstellen möchtest:

```bash
#!/bin/bash

cd ~/projects/phishaware

# Verzeichnisse
mkdir -p backend/app/{auth,api,services,utils}
mkdir -p frontend/src/{components,pages,services}
mkdir -p docs

# Dateien kopieren
# (alle Files von oben manuell oder via curl/wget)

# Oder einfacher: Kopiere alle Files aus diesem Dokument
# Öffne jeden Abschnitt und paste in die richtige Datei

echo "✅ Verzeichnis-Struktur erstellt!"
```

---

## Checkliste: Bevor du `docker-compose up -d` startest

```
☐ Verzeichnis ~/projects/phishaware existiert
☐ backend/requirements.txt existiert
☐ backend/Dockerfile existiert
☐ backend/.env.example existiert
☐ backend/.env existiert (mit echten Werten!)
☐ frontend/package.json existiert
☐ frontend/Dockerfile.dev existiert
☐ frontend/vite.config.ts existiert
☐ docker-compose.yml existiert
☐ nginx.conf existiert
☐ .gitignore existiert

☐ `chmod 600 backend/.env` ausgeführt
☐ `git init` ausgeführt
☐ SSH-Verbindung zur VM funktioniert
```

---

## Falls du SCHNELL starten möchtest

Lade dir alles von GitHub:

```bash
git clone https://github.com/YOUR_USERNAME/phishaware.git ~/projects/phishaware
cd ~/projects/phishaware

# Editiere .env
cp backend/.env.example backend/.env
nano backend/.env

# Starte Docker
docker-compose up -d
```

---

**Dokument-Version:** 1.0  
**Status:** Ready für Next Steps 🚀
