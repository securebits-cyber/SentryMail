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

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
