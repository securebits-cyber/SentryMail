FROM python:3.14-slim-bookworm

WORKDIR /app

# libc6-dev und libssl-dev werden gebraucht, weil das Enterprise-Add-on
# yara-python aus dem Quelltext uebersetzt: Fuer Python 3.14 gibt es kein
# fertiges Wheel, und gcc allein reicht nicht (die C-Header fehlen sonst).
# Beide bleiben im Image, damit ein Add-on auch nachtraeglich installierbar
# bleibt - ein Add-on-Update soll keinen neuen Core-Build erzwingen.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    libssl-dev \
    postgresql-client \
    curl \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x /app/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Der Entrypoint holt vor dem Start die lizenzierten Add-on-Pakete vom
# Lizenzserver (siehe scripts/fetch_addons.py) und startet danach das CMD.
# Ohne LICENSE_SERVER_URL und LICENSE_KEY passiert nichts - die Installation
# laeuft dann als Open Core.
#
# start-period des Healthchecks bewusst unveraendert: Der Paketbezug laeuft
# VOR uvicorn, der Container gilt also erst danach als gestartet. Ein langer
# Erstdownload verzoegert den Start, laesst den Healthcheck aber nicht
# fehlschlagen, weil dieser erst nach dem Start des Kommandos zaehlt.
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
