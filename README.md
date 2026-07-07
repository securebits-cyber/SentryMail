<div align="center">

# 🛡️ HumanShield.APP

**Selbstgehostete Plattform für Phishing-Awareness** — simulierte Phishing-Kampagnen planen, versenden und pro Empfänger auswerten, um Mitarbeitende messbar gegen Social Engineering zu wappnen.

![Self-hosted](https://img.shields.io/badge/Self--hosted-Docker%20Compose-2496ED?logo=docker&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Editions](https://img.shields.io/badge/Modell-Open%20Core-blue)
![License](https://img.shields.io/badge/License-MPL%202.0-brightgreen)

📖 [English README](README.en.md)

</div>

---

HumanShield.APP hilft Organisationen, ihre menschliche Angriffsfläche zu verkleinern: realistische Phishing-Simulationen durchführen, Öffnungen/Klicks/Eingaben nachvollziehen und daraus gezielte Sensibilisierung ableiten. Die Plattform läuft **vollständig bei dir** — alle umgebungsspezifischen Werte (Domain, IdP, SMTP) kommen aus der Konfiguration, nichts ist im Code fest verdrahtet.

## ✨ Funktionen

**Kampagnen & Tracking**
- Kampagnen-Assistent mit optionaler Zeitplanung
- Tracking von **Öffnungen, Klicks und Formular-Eingaben** — ausgewertet **pro Empfänger**, mit **Session-Verlauf** (Mehrfachbesuche) je Empfänger
- **Engagement-Analytics** — Aufschlüsselung nach Browser, Betriebssystem, Gerätetyp und **Ländern** (optionale lokale GeoIP-Datenbank), UTM-Parameter und Referrer
- Control-Center-Dashboard mit **KPIs, Risiko-Score (Ampel), Trichter, Zeitachse, Aktivitäts-Heatmap** und **Human-Risk-Score**; **Management Report** und CSV-Export

**Inhalte**
- Vorlagen mit **HTML- oder Markdown-Editor**, Personalisierungs-Variablen und Live-Vorschau
- **`.eml`-Import** echter E-Mails inklusive Anhänge
- Landing Pages mit optionaler Formular-Erfassung, Weiterleitung und **Live-Vorschau im Editor**

**Empfänger**
- Gruppen per **manueller Eingabe, CSV oder LDAP-Import**

**Zugang & Sicherheit**
- Lokaler Login und optionales **OIDC / Single Sign-On**
- **Zwei-Faktor-Authentifizierung** (Authenticator-App oder E-Mail-Code, erzwingbar, Backup-Codes)
- Rollen, Audit-Log, Secrets verschlüsselt at-rest (Argon2id, Fernet)

**KI-Unterstützung** (Business, anbieter-neutral)
- **KI-gestützte Erstellung** von Mail-Vorlagen und Landing Pages über eine frei konfigurierbare, OpenAI-kompatible Anbindung (OpenAI, Azure, Mistral, Groq, OpenRouter, Ollama u. a.)

**Versand**
- **Sending Profiles** (SMTP je Absender) plus globales Fallback-SMTP — beliebiger Anbieter

## 🧱 Tech-Stack

| Schicht | Technologie |
|---|---|
| Backend | FastAPI · SQLAlchemy · Alembic |
| Frontend | React · Vite · TypeScript · Tailwind CSS |
| Datenbank / Cache | PostgreSQL · Redis |
| Proxy / TLS | Caddy |
| Betrieb | Docker Compose (rootless, gehärtet) |

## 🖥️ Systemanforderungen

Selbstgehostet als Docker-Compose-Stack (PostgreSQL, Redis, FastAPI-Backend, Frontend, Caddy). Die Werte sind Richtwerte für einen einzelnen Host; der Bedarf steigt mit Empfängerzahl, paralleler Nutzung und optionalen Business-Features (PDF-Reports, KI).

| Ressource | Minimum | Empfohlen |
|---|---|---|
| CPU | 2 vCPU | 2–4 vCPU |
| RAM | 2 GB | 4 GB |
| Datenträger | 15 GB SSD | 20–40 GB SSD |
| OS | Linux (x86-64 oder ARM64) mit Docker Engine (≥ 24) + Docker Compose v2 | dito |

- **Docker Compose v2** meint das aktuelle, integrierte `docker compose`-Plugin (aktuelle Generation, Versionsstände 2.x) — nicht das eingestellte alte `docker-compose` v1. Prüfen mit `docker compose version`.
- **Minimum** genügt für kleinere Organisationen (bis einige Hundert Empfänger, gelegentliche Kampagnen).
- **Empfohlen** gibt Reserve für größere Kampagnen, PDF-Reporting, KI-Funktionen und wachsende Tracking-Daten in PostgreSQL.
- **SSD** wird für die Datenbank empfohlen; die Tracking-Ereignisse wachsen mit jeder Kampagne.
- Netzwerk: ausgehender SMTP-Zugang (Versand) und Erreichbarkeit der `APP_DOMAIN` für die Zielpersonen (Tracking).

## 🚀 Schnellstart

```bash
git clone https://github.com/securebitsorg/HumanShield.APP.git
cd HumanShield.APP
cp .env.example .env
# .env ausfüllen: SECRET_KEY, Datenbank, SMTP, INITIAL_ADMIN_*
docker compose up -d
```

Datenbank-Migrationen laufen beim Start automatisch. Anschließend das Dashboard über die konfigurierte Domain (bzw. `https://localhost`) öffnen und mit dem in `.env` gesetzten Initial-Admin anmelden.

> 📌 **Tracking-Hinweis:** Öffnungen/Klicks entstehen nur, wenn Empfänger die unter `APP_DOMAIN` gesetzte Adresse erreichen können. Da viele Mail-Clients das Öffnungs-Pixel blockieren, sind **Klicks** das verlässlichere Signal.

## 🏗️ Architektur

```mermaid
flowchart LR
  U[Browser] --> C[Caddy]
  C -->|/api, /track| B[FastAPI Backend]
  C --> F[React Frontend]
  B --> P[(PostgreSQL)]
  B --> R[(Redis)]
```

Caddy leitet `/api/*` und die öffentlichen Tracking-Endpunkte `/track/*` an das Backend, alles Übrige an das Frontend.

## ⚙️ Konfiguration

Sämtliche Einstellungen kommen aus der `.env` — siehe [`.env.example`](.env.example) für alle Optionen (App, Datenbank, SMTP, OIDC, LDAP, Lizenzierung). Login-, OIDC-, LDAP-, SMTP- und Sicherheits­einstellungen lassen sich zusätzlich im Dashboard verwalten.

## 🔒 Sicherheit

- Passwörter mit **Argon2id**, Laufzeit-Secrets (SMTP/LDAP/OIDC/TOTP) verschlüsselt at-rest (**Fernet**)
- Zweistufiger Login bei aktivem 2FA, Audit-Log über Anmeldungen und Systemänderungen
- Betreiber-Secrets ausschließlich über `.env`, nie im Code

Details im [Sicherheits-Wiki](https://github.com/securebitsorg/HumanShield.APP/wiki/Sicherheit). Awareness-Kontext zu **NIS2 & BSI** im [entsprechenden Wiki-Artikel](https://github.com/securebitsorg/HumanShield.APP/wiki/NIS2-und-BSI).

## 🧩 Editionen (Open Core)

Der **Kern** von HumanShield.APP (alle oben genannten Funktionen) ist unter der **Mozilla Public License 2.0 (MPL-2.0)** quelloffen und vollständig nutzbar. Zusätzlich gibt es **zwei kostenpflichtige Add-ons**, die per Lizenz freigeschaltet und als separate, private Pakete ausgeliefert werden.

**Business-Add-on**
- **LDAP**-Verzeichnisimport von Empfängern (inkl. LDAPS mit eigenem CA-Zertifikat)
- **Azure AD / Entra ID**-Import von Empfängern (Microsoft Graph)
- **E-Mail-Upload** (`.eml`) als Vorlagen-Entwurf
- **Vorlagen-Bibliothek** (fertige Awareness-Vorlagen: DHL, Amazon, Rechnung, M365, HR, Bank, PayPal, LinkedIn, PDF-Köder, QR-Kampagne)
- **Landing-Page-Bibliothek** — passende, klonbare Landing Pages zu jeder Vorlage, direkt im Menü „Landing Pages" verfügbar
- **Angriffsarten** — Spear-Phishing-, Whaling- (CEO-Fraud) und dateibasierte Vorlagen (Köder-Anhang) in der Bibliothek
- **KI-Anbindung** — anbieter-neutrale, OpenAI-kompatible Erstellung von Mail-Vorlagen und Landing Pages
- **PDF-Export** (Management Report & Kampagnen-Ergebnisse)
- **QR-Code-Phishing (Quishing)** — QR-Codes pro Empfänger
- **Webhooks** — Event-Trigger (Öffnung/Klick/Submit) an externe Systeme
- **Passwortabfrage** — abgeschickte Formulardaten erfassen (Passwörter maskiert, nie im Klartext)
- **Passkeys (WebAuthn)** — phishing-resistente Zwei-Faktor-Authentifizierung
- **Business-Reporting** — Executive Report (PDF), Trendanalyse und Benutzerentwicklung
- **Wiederkehrende Kampagnen** — automatischer, terminierter Wiederversand per Scheduler
- **Mehrstufige Kampagnen** — Kampagnen-Sequenzen (mehrere Stufen mit zeitlichem Abstand)
- **Nachweis-Center** — je eigenes PDF für **DSGVO** (Art. 32), **NIS2** (Art. 21), **ISO 27001** (A.6.3), **Awareness-Nachweis**, **Audit-Bericht**, **Zertifikat** und **Schulungsnachweise**

**Enterprise-Add-on** (enthält alle Business-Funktionen)
- **White-Label** — eigenes Branding (App-Name, Akzentfarben, Logo)
- **SAML-SSO** — Anmeldung über SAML-2.0-Identity-Provider (signaturgeprüfte Assertions)
- **Automatische/Risiko-Kampagnen** — Empfänger werden automatisch nach Risiko gewählt und in festem Intervall versendet
- **Enterprise-Reporting** — Schulungsfortschritt, Zertifikatsstatus und individuelle Berichte je Person (PDF)
- **KI-Risikoanalyse** — KI-gestützte Auswertung der Human-Risk-Kennzahlen
- **SIEM-Export** — Tracking-Events an Splunk HEC, Elasticsearch, Microsoft Sentinel oder generisches JSON

Ohne Lizenz läuft die Plattform als reiner Open-Core-Betrieb — ohne Fehler, ohne Sperren.

## 📖 Dokumentation

Ausführliche Anleitungen im **[Wiki](https://github.com/securebitsorg/HumanShield.APP/wiki)**:
[Installation](https://github.com/securebitsorg/HumanShield.APP/wiki/Installation) ·
[Konfiguration](https://github.com/securebitsorg/HumanShield.APP/wiki/Konfiguration) ·
[Funktionen](https://github.com/securebitsorg/HumanShield.APP/wiki/Funktionen) ·
[Architektur](https://github.com/securebitsorg/HumanShield.APP/wiki/Architektur) ·
[FAQ](https://github.com/securebitsorg/HumanShield.APP/wiki/FAQ)

## 🤝 Mitwirken

Beiträge sind willkommen. Bitte für Änderungen einen Branch anlegen, aussagekräftige Commits schreiben und einen Pull Request öffnen (siehe [PR-Template](.github/pull_request_template.md)).

## 📄 Lizenz

Der Kern steht unter der **[Mozilla Public License 2.0](LICENSE)** — einer OSI-anerkannten Open-Source-Lizenz mit dateibasiertem Copyleft: frei nutzbar, veränderbar und weiterverteilbar (auch kommerziell und als gehosteter Dienst); Änderungen an MPL-lizenzierten Dateien müssen unter der MPL offengelegt werden. Die kommerziellen **Enterprise-Add-ons** sind davon getrennt und proprietär. Kontakt für Add-on-Lizenzen: `kontakt@humanshield.app`.

---

<div align="center">

Ein Projekt von **HumanShield-Awareness UG** · verantwortungsvoll für autorisierte Awareness-Schulungen einsetzen.

</div>
