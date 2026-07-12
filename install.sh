#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# HumanShield.APP - Interaktive Installationsroutine / Interactive install routine
#
# DE: Fuehrt Endkunden durch alle wichtigen Einstellungen fuer eine fehlerfreie
#     Installation des Stacks, erzeugt eine gueltige .env aus .env.example,
#     generiert Secrets und kann den Docker-Compose-Stack starten.
# EN: Guides operators through all important settings for an error-free stack
#     installation, produces a valid .env from .env.example, generates secrets
#     and can start the Docker Compose stack.
#
# Alle Werte bleiben umgebungsspezifisch in der .env - nichts wird im Code fest
# verdrahtet. / All values stay environment-specific in .env - nothing is
# hard-wired in the code.

# DE: Unter bash laufen. Wird das Skript mit "sh install.sh" (dash) gestartet,
#     hier automatisch mit bash neu starten - sonst scheitern bash-Features.
# EN: Run under bash. If started via "sh install.sh" (dash), re-exec with bash
#     here - otherwise bash-only features fail.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# --- Pfade / paths -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${EXAMPLE_FILE:=${SCRIPT_DIR}/.env.example}"
: "${ENV_FILE:=${SCRIPT_DIR}/.env}"

# --- Nicht-interaktiver Modus / non-interactive mode -------------------------
# ASSUME_DEFAULTS=1 uebernimmt bei jeder Frage die Vorgabe (fuer Tests/CI).
: "${ASSUME_DEFAULTS:=0}"

# --- Farben / colours (nur bei TTY) -----------------------------------------
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"
  GREEN="$(printf '\033[32m')"; YELLOW="$(printf '\033[33m')"
  RED="$(printf '\033[31m')"; CYAN="$(printf '\033[36m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; CYAN=""; RESET=""
fi

# --- Sprache / language ------------------------------------------------------
UILANG="${UILANG:-}"

# msg <deutsch> <english>
msg() { if [ "$UILANG" = "en" ]; then printf '%s' "$2"; else printf '%s' "$1"; fi; }

die() { printf '%s%s%s\n' "$RED" "$1" "$RESET" >&2; exit 1; }

# --- .env-Helfer / .env helpers ---------------------------------------------
# get_env <KEY> -> aktueller Wert aus ENV_FILE (leer, falls nicht/auskommentiert)
get_env() {
  KEY="$1" awk -F= 'BEGIN{k=ENVIRON["KEY"]}
    $0 ~ "^"k"=" { sub("^"k"=",""); print; exit }' "$ENV_FILE"
}

# set_env <KEY> <VALUE> -> ersetzt eine aktive KEY=-Zeile oder haengt sie an.
# Werte werden ueber die Umgebung uebergeben, damit Sonderzeichen (/ @ : + =)
# nicht als Trennzeichen missverstanden werden.
set_env() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"
  KEY="$key" VAL="$val" awk '
    BEGIN{ k=ENVIRON["KEY"]; v=ENVIRON["VAL"]; done=0 }
    $0 ~ "^"k"=" && !done { print k"="v; done=1; next }
    { print }
    END{ if(!done) print k"="v }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

# --- Zufalls-Secret / random secret -----------------------------------------
# gen_secret <bytes> -> URL-sicherer Hex-String (keine Sonderzeichen -> sicher
# in DATABASE_URL/Passwoertern, kein Escaping noetig).
gen_secret() {
  local bytes="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c $((bytes * 2)) || true
    echo
  fi
}

# --- Eingabe / prompt --------------------------------------------------------
# ask <KEY> <prompt_de> <prompt_en> [default]
# Fragt einen Wert ab; Default = aktueller .env-Wert oder uebergebener Default.
ask() {
  local key="$1" pd="$2" pe="$3" default="${4:-}" cur ans
  cur="$(get_env "$key" || true)"
  # Platzhalter-Werte aus .env.example nicht als sinnvollen Default anbieten.
  case "$cur" in
    *change-me*|*example.com*|"") : ;;
    *) default="$cur" ;;
  esac
  local prompt; prompt="$(msg "$pd" "$pe")"
  if [ "$ASSUME_DEFAULTS" = "1" ]; then
    ans="$default"
  else
    # Prompt nach stderr: stdout ist der Rueckgabewert fuer $(ask ...).
    if [ -n "$default" ]; then
      printf '%s%s%s [%s%s%s]: ' "$BOLD" "$prompt" "$RESET" "$DIM" "$default" "$RESET" >&2
    else
      printf '%s%s%s: ' "$BOLD" "$prompt" "$RESET" >&2
    fi
    IFS= read -r ans || ans=""
    [ -z "$ans" ] && ans="$default"
  fi
  set_env "$key" "$ans"
  printf '%s' "$ans"
}

# ask_secret <KEY> <prompt_de> <prompt_en> -> verdeckte Eingabe (kein Echo)
ask_secret() {
  local key="$1" pd="$2" pe="$3" ans
  local prompt; prompt="$(msg "$pd" "$pe")"
  if [ "$ASSUME_DEFAULTS" = "1" ]; then
    ans=""
  else
    printf '%s%s%s: ' "$BOLD" "$prompt" "$RESET" >&2
    IFS= read -rs ans || ans=""
    printf '\n' >&2
  fi
  # Leere Eingabe = Wert unveraendert lassen. Bewusst mit Status 0 enden, damit
  # 'set -e' bei leerem Passwort nicht das Skript abbricht.
  if [ -n "$ans" ]; then set_env "$key" "$ans"; fi
  return 0
}

# yesno <prompt_de> <prompt_en> <default:y|n> -> 0=ja / 1=nein
yesno() {
  local pd="$1" pe="$2" default="$3" ans
  local prompt; prompt="$(msg "$pd" "$pe")"
  local hint; if [ "$default" = "y" ]; then hint="[J/n]"; else hint="[j/N]"; fi
  [ "$UILANG" = "en" ] && { if [ "$default" = "y" ]; then hint="[Y/n]"; else hint="[y/N]"; fi; }
  if [ "$ASSUME_DEFAULTS" = "1" ]; then
    ans="$default"
  else
    printf '%s%s %s%s ' "$BOLD" "$prompt" "$hint" "$RESET" >&2
    IFS= read -r ans || ans=""
    [ -z "$ans" ] && ans="$default"
  fi
  case "$ans" in [yYjJ]*) return 0 ;; *) return 1 ;; esac
}

# --- Start -------------------------------------------------------------------
if [ -z "$UILANG" ] && [ "$ASSUME_DEFAULTS" != "1" ]; then
  printf '%sSprache / Language:%s [1] Deutsch  [2] English [1]: ' "$BOLD" "$RESET"
  IFS= read -r _l || _l=""
  case "$_l" in 2) UILANG=en ;; *) UILANG=de ;; esac
fi
UILANG="${UILANG:-de}"

printf '\n%s%s%s\n' "$CYAN$BOLD" "HumanShield.APP $(msg 'Installationsroutine' 'install routine')" "$RESET"
printf '%s\n\n' "$(msg 'Fuehrt dich durch alle wichtigen Einstellungen.' 'Guides you through all important settings.')"

# --- 1. Voraussetzungen / prerequisites -------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '1) Voraussetzungen pruefen' '1) Checking prerequisites')" "$RESET"
if command -v docker >/dev/null 2>&1; then
  printf '   %s✓%s docker: %s\n' "$GREEN" "$RESET" "$(docker --version 2>/dev/null || echo '?')"
else
  printf '   %s✗%s %s\n' "$RED" "$RESET" "$(msg 'docker nicht gefunden' 'docker not found')"
  die "$(msg 'Bitte Docker Engine (>= 24) installieren.' 'Please install Docker Engine (>= 24).')"
fi
if docker compose version >/dev/null 2>&1; then
  printf '   %s✓%s docker compose: %s\n' "$GREEN" "$RESET" "$(docker compose version --short 2>/dev/null || echo '?')"
else
  printf '   %s✗%s %s\n' "$RED" "$RESET" "$(msg 'docker compose v2 nicht gefunden' 'docker compose v2 not found')"
  die "$(msg 'Bitte Docker Compose v2 (docker compose) installieren.' 'Please install Docker Compose v2 (docker compose).')"
fi
printf '\n'

# --- 1b. Neuestes Release ziehen / pull latest release ----------------------
# Holt vor der Konfiguration den neuesten veroeffentlichten Release-Tag (v*).
# Nur in einer Git-Arbeitskopie; ZIP-Installationen ueberspringen das. Da sich
# install.sh dabei selbst aktualisieren kann, wird das Skript nach dem Wechsel
# einmal neu gestartet (Guard HS_SELF_UPDATED verhindert eine Schleife).
if [ "${HS_SELF_UPDATED:-0}" != "1" ] \
   && command -v git >/dev/null 2>&1 \
   && git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  printf '%s%s%s\n' "$BOLD" "$(msg 'Neuestes Release' 'Latest release')" "$RESET"
  git -C "$SCRIPT_DIR" fetch --tags --quiet 2>/dev/null || true
  latest="$(git -C "$SCRIPT_DIR" tag -l 'v*' --sort=-v:refname | head -n1)"
  current="$(git -C "$SCRIPT_DIR" describe --tags --always 2>/dev/null || echo '?')"
  if [ -z "$latest" ]; then
    printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg 'Kein Release-Tag gefunden - aktuellen Stand verwenden.' 'No release tag found - using current state.')"
  elif [ "$current" = "$latest" ]; then
    printf '   %s✓%s %s (%s)\n' "$GREEN" "$RESET" "$(msg 'Bereits auf dem neuesten Release' 'Already on the latest release')" "$latest"
  elif yesno "Auf neuestes Release $latest wechseln?" "Switch to the latest release $latest?" y; then
    if git -C "$SCRIPT_DIR" checkout --quiet "$latest" 2>/dev/null; then
      printf '   %s✓%s %s -> %s\n' "$GREEN" "$RESET" "$(msg 'gewechselt auf' 'switched to')" "$latest"
      printf '   %s\n' "$(msg 'Starte Installationsroutine des Releases neu ...' 'Restarting the release install routine ...')"
      HS_SELF_UPDATED=1 exec bash "$SCRIPT_DIR/install.sh" "$@"
    else
      printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg 'Wechsel nicht moeglich (lokale Aenderungen?) - aktuellen Stand verwenden.' 'Switch failed (local changes?) - using current state.')"
    fi
  fi
  printf '\n'
fi

# --- 2. .env vorbereiten / prepare .env -------------------------------------
[ -f "$EXAMPLE_FILE" ] || die "$(msg '.env.example fehlt' '.env.example missing'): $EXAMPLE_FILE"
if [ -f "$ENV_FILE" ]; then
  printf '%s%s%s\n' "$YELLOW" "$(msg 'Es existiert bereits eine .env.' 'An .env already exists.')" "$RESET"
  if yesno 'Vorhandene .env als Basis weiterverwenden?' 'Reuse existing .env as base?' y; then
    printf '   %s\n' "$(msg 'Bestehende Werte werden als Vorgaben genutzt.' 'Existing values are used as defaults.')"
  else
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    printf '   %s\n' "$(msg 'Neu aus .env.example erzeugt.' 'Recreated from .env.example.')"
  fi
else
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  printf '%s\n' "$(msg '.env aus .env.example erzeugt.' '.env created from .env.example.')"
fi
printf '\n'

# --- 3. App / Domain ---------------------------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '2) App & Domain' '2) App & domain')" "$RESET"
printf '   %s\n' "$(msg 'Echte Domain -> automatisches TLS (Lets Encrypt). Hinter externem Reverse Proxy: ":80".' 'Real domain -> automatic TLS (Lets Encrypt). Behind an external reverse proxy: ":80".')"
DOMAIN="$(ask APP_DOMAIN 'Domain der Anwendung' 'Application domain' 'humanshield.example.com')"
# Caddy hoert standardmaessig auf dieselbe Adresse.
CADDY="$(ask CADDY_SITE_ADDRESS 'Caddy-Adresse (Enter = Domain uebernehmen, oder ":80")' 'Caddy address (Enter = use domain, or ":80")' "$DOMAIN")"
printf '\n'

# --- 4. Datenbank / database -------------------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '3) Datenbank' '3) Database')" "$RESET"
DB_NAME="$(ask POSTGRES_DB 'Datenbankname' 'Database name' 'phishaware')"
DB_USER="$(ask POSTGRES_USER 'Datenbank-Benutzer' 'Database user' 'phishaware')"
DB_PW="$(get_env POSTGRES_PASSWORD || true)"
case "$DB_PW" in ""|*change-me*)
  if yesno 'Sicheres DB-Passwort automatisch generieren?' 'Auto-generate a strong DB password?' y; then
    DB_PW="$(gen_secret 24)"
    printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$(msg 'DB-Passwort generiert.' 'DB password generated.')"
  else
    ask_secret POSTGRES_PASSWORD 'DB-Passwort eingeben' 'Enter DB password'
    DB_PW="$(get_env POSTGRES_PASSWORD)"
  fi
  set_env POSTGRES_PASSWORD "$DB_PW"
esac
# DATABASE_URL immer aus Name/User/Passwort synchron halten.
set_env DATABASE_URL "postgresql+psycopg://${DB_USER}:${DB_PW}@postgres:5432/${DB_NAME}"
printf '   %s\n' "$(msg 'DATABASE_URL synchronisiert.' 'DATABASE_URL synced.')"
printf '\n'

# --- 5. Sicherheit / security -----------------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '4) Sicherheit' '4) Security')" "$RESET"
SECRET="$(get_env SECRET_KEY || true)"
if [ -z "$SECRET" ] || [ "${#SECRET}" -lt 32 ] || case "$SECRET" in *change-me*) true;; *) false;; esac; then
  SECRET="$(gen_secret 32)"
  set_env SECRET_KEY "$SECRET"
  printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$(msg 'SECRET_KEY generiert.' 'SECRET_KEY generated.')"
else
  printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$(msg 'Vorhandener SECRET_KEY beibehalten.' 'Existing SECRET_KEY kept.')"
fi
printf '\n'

# --- 6. Erster Admin / initial admin ----------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '5) Erster Admin (nur beim allerersten Start wirksam)' '5) Initial admin (only effective on the very first start)')" "$RESET"
ask INITIAL_ADMIN_EMAIL 'Admin-E-Mail' 'Admin email' 'admin@example.com' >/dev/null
ADMIN_PW="$(get_env INITIAL_ADMIN_PASSWORD || true)"
case "$ADMIN_PW" in ""|*change-me*)
  if yesno 'Admin-Startpasswort automatisch generieren?' 'Auto-generate initial admin password?' y; then
    ADMIN_PW="$(gen_secret 12)"
    set_env INITIAL_ADMIN_PASSWORD "$ADMIN_PW"
    printf '   %s✓%s %s: %s%s%s\n' "$GREEN" "$RESET" "$(msg 'Startpasswort' 'Initial password')" "$BOLD" "$ADMIN_PW" "$RESET"
    printf '   %s%s%s\n' "$YELLOW" "$(msg 'Notieren und nach dem ersten Login aendern!' 'Note it down and change it after first login!')" "$RESET"
  else
    ask_secret INITIAL_ADMIN_PASSWORD 'Admin-Passwort eingeben' 'Enter admin password'
  fi
esac
printf '\n'

# --- 7. SMTP -----------------------------------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '6) SMTP-Versand (beliebiger Anbieter)' '6) SMTP delivery (any provider)')" "$RESET"
if yesno 'SMTP jetzt konfigurieren?' 'Configure SMTP now?' y; then
  ask SMTP_HOST 'SMTP-Host' 'SMTP host' 'smtp.example.com' >/dev/null
  ask SMTP_PORT 'SMTP-Port' 'SMTP port' '587' >/dev/null
  ask SMTP_USERNAME 'SMTP-Benutzer' 'SMTP username' 'noreply@example.com' >/dev/null
  ask_secret SMTP_PASSWORD 'SMTP-Passwort' 'SMTP password'
  ask SMTP_FROM_EMAIL 'Absenderadresse' 'From address' 'noreply@example.com' >/dev/null
  ask SMTP_FROM_NAME 'Absendername' 'From name' 'HumanShield-Awareness' >/dev/null
  ask SMTP_TLS_MODE 'TLS-Modus (starttls/ssl/none)' 'TLS mode (starttls/ssl/none)' 'starttls' >/dev/null
else
  printf '   %s\n' "$(msg 'Uebersprungen - spaeter im Dashboard unter Sending Profiles moeglich.' 'Skipped - can be set later in the dashboard under Sending Profiles.')"
fi
printf '\n'

# --- 8. Lizenz / license (optional) -----------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '7) Lizenz / Add-ons (optional)' '7) License / add-ons (optional)')" "$RESET"
printf '   %s\n' "$(msg 'Leer lassen = reiner Open-Core-Betrieb ohne kostenpflichtige Add-ons.' 'Leave empty = pure Open Core without paid add-ons.')"
if yesno 'Business-/Enterprise-Lizenz hinterlegen?' 'Configure a Business/Enterprise license?' n; then
  ask LICENSE_SERVER_URL 'Lizenzserver-URL' 'License server URL' 'https://license.humanshield-awareness.de' >/dev/null
  ask LICENSE_KEY 'Lizenzschluessel' 'License key' '' >/dev/null
else
  printf '   %s\n' "$(msg 'Ohne Lizenz (Open Core).' 'No license (Open Core).')"
fi
printf '\n'

# --- 9. Abschluss / finish ---------------------------------------------------
chmod 600 "$ENV_FILE" 2>/dev/null || true
printf '%s%s%s\n' "$GREEN$BOLD" "$(msg '✓ Konfiguration gespeichert in' '✓ Configuration saved to')" "$RESET"
printf '  %s (chmod 600)\n\n' "$ENV_FILE"

printf '%s%s%s\n' "$BOLD" "$(msg 'Zusammenfassung:' 'Summary:')" "$RESET"
printf '  Domain        : %s\n' "$DOMAIN"
printf '  Caddy         : %s\n' "$CADDY"
printf '  DB            : %s@postgres/%s\n' "$DB_USER" "$DB_NAME"
printf '  Admin         : %s\n' "$(get_env INITIAL_ADMIN_EMAIL)"
printf '  SMTP          : %s\n' "$(get_env SMTP_HOST)"
printf '  Lizenz/License: %s\n\n' "$([ -n "$(get_env LICENSE_KEY)" ] && msg 'gesetzt' 'set' || msg 'keine (Open Core)' 'none (Open Core)')"

if yesno 'Stack jetzt starten (docker compose up -d)?' 'Start the stack now (docker compose up -d)?' n; then
  ( cd "$SCRIPT_DIR" && docker compose up -d )
  printf '\n%s%s%s\n' "$GREEN" "$(msg 'Gestartet. Dashboard:' 'Started. Dashboard:')" "$RESET"
  printf '  https://%s\n' "$DOMAIN"
else
  printf '%s\n' "$(msg 'Spaeter starten mit:' 'Start later with:')"
  printf '  %sdocker compose up -d%s\n' "$BOLD" "$RESET"
fi
