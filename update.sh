#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SentryMail - Update-Routine / update routine
#
# DE: Aktualisiert eine bestehende Installation sicher: optionales DB-Backup,
#     Code per git aktualisieren, Stack neu bauen/starten (Migrationen laufen
#     dabei automatisch beim Backend-Start) und Gesundheit pruefen.
# EN: Safely updates an existing installation: optional DB backup, update code
#     via git, rebuild/restart the stack (migrations run automatically on
#     backend start) and verify health.
#
# Die .env wird NICHT veraendert. / The .env is NOT modified.

# DE: Unter bash laufen. Wird das Skript mit "sh update.sh" (dash) gestartet,
#     hier automatisch mit bash neu starten - sonst scheitern bash-Features.
# EN: Run under bash. If started via "sh update.sh" (dash), re-exec with bash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# --- Pfade / paths -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${ENV_FILE:=${SCRIPT_DIR}/.env}"
: "${BACKUP_DIR:=${SCRIPT_DIR}/backups}"

# --- Argumente / arguments ---------------------------------------------------
# DE: --bundle <datei> spielt ein signiertes Offline-Bundle ein statt per git zu
#     aktualisieren (air-gapped Installationen).
# EN: --bundle <file> applies a signed offline bundle instead of updating via git
#     (air-gapped installations).
BUNDLE_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bundle)
      [ $# -ge 2 ] || { printf 'Fehlender Dateiname nach --bundle / missing file after --bundle\n' >&2; exit 2; }
      BUNDLE_FILE="$2"; shift 2 ;;
    --bundle=*)
      BUNDLE_FILE="${1#--bundle=}"; shift ;;
    -h|--help)
      printf 'Aufruf / usage: %s [--bundle <datei.tar.gz>]\n' "$(basename "$0")"; exit 0 ;;
    *)
      printf 'Unbekannte Option / unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
done
if [ -n "$BUNDLE_FILE" ]; then
  [ -f "$BUNDLE_FILE" ] || { printf 'Bundle nicht gefunden / bundle not found: %s\n' "$BUNDLE_FILE" >&2; exit 2; }
  BUNDLE_FILE="$(cd "$(dirname "$BUNDLE_FILE")" && pwd)/$(basename "$BUNDLE_FILE")"
fi

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

# get_env <KEY> -> aktueller Wert aus ENV_FILE (leer, falls nicht/auskommentiert)
get_env() {
  [ -f "$ENV_FILE" ] || return 0
  KEY="$1" awk -F= 'BEGIN{k=ENVIRON["KEY"]}
    $0 ~ "^"k"=" { sub("^"k"=",""); print; exit }' "$ENV_FILE"
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

# --- Start / language --------------------------------------------------------
if [ -z "$UILANG" ] && [ "$ASSUME_DEFAULTS" != "1" ]; then
  printf '%sSprache / Language:%s [1] Deutsch  [2] English [1]: ' "$BOLD" "$RESET"
  IFS= read -r _l || _l=""
  case "$_l" in 2) UILANG=en ;; *) UILANG=de ;; esac
fi
UILANG="${UILANG:-de}"

printf '\n%s%s%s\n' "$CYAN$BOLD" "SentryMail $(msg 'Update-Routine' 'update routine')" "$RESET"
printf '%s\n\n' "$(msg 'Aktualisiert deine bestehende Installation.' 'Updates your existing installation.')"

# --- 1. Voraussetzungen / prerequisites -------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '1) Voraussetzungen pruefen' '1) Checking prerequisites')" "$RESET"
command -v docker >/dev/null 2>&1 || die "$(msg 'docker nicht gefunden.' 'docker not found.')"
docker compose version >/dev/null 2>&1 || die "$(msg 'docker compose v2 nicht gefunden.' 'docker compose v2 not found.')"
printf '   %s✓%s docker / docker compose\n' "$GREEN" "$RESET"
[ -f "$ENV_FILE" ] || die "$(msg '.env fehlt - zuerst ./install.sh ausfuehren.' '.env missing - run ./install.sh first.')"
printf '   %s✓%s .env\n' "$GREEN" "$RESET"

HAVE_GIT=0
if command -v git >/dev/null 2>&1 && git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  HAVE_GIT=1
  printf '   %s✓%s git (%s)\n' "$GREEN" "$RESET" "$(git -C "$SCRIPT_DIR" describe --tags --always 2>/dev/null || echo '?')"
else
  printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg 'kein git-Repository - Code-Update wird uebersprungen (ZIP-Installation).' 'no git repository - code update skipped (ZIP install).')"
fi
printf '\n'

# --- 2. DB-Backup / DB backup -----------------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '2) Datenbank-Backup' '2) Database backup')" "$RESET"
DB_NAME="$(get_env POSTGRES_DB || true)"; DB_USER="$(get_env POSTGRES_USER || true)"
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg 'POSTGRES_DB/USER nicht in .env - Backup uebersprungen.' 'POSTGRES_DB/USER not in .env - backup skipped.')"
elif ! ( cd "$SCRIPT_DIR" && docker compose ps postgres 2>/dev/null | grep -q "Up\|running" ); then
  printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg 'postgres laeuft nicht - Backup uebersprungen.' 'postgres is not running - backup skipped.')"
elif yesno 'Vor dem Update ein DB-Backup erstellen?' 'Create a DB backup before updating?' y; then
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  OUT="${BACKUP_DIR}/db-${DB_NAME}-${STAMP}.sql.gz"
  printf '   %s' "$(msg 'Sichere Datenbank ...' 'Dumping database ...')"
  if ( cd "$SCRIPT_DIR" && docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" ) | gzip > "$OUT"; then
    printf ' %s✓%s %s (%s)\n' "$GREEN" "$RESET" "$OUT" "$(du -h "$OUT" 2>/dev/null | cut -f1)"
  else
    rm -f "$OUT"
    die "$(msg 'Backup fehlgeschlagen - Update abgebrochen.' 'Backup failed - update aborted.')"
  fi
else
  printf '   %s%s%s\n' "$YELLOW" "$(msg 'Ohne Backup fortgefahren.' 'Continuing without backup.')" "$RESET"
fi
printf '\n'

# --- 3. Code aktualisieren / update code ------------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '3) Code aktualisieren' '3) Update code')" "$RESET"
if [ -n "$BUNDLE_FILE" ]; then
  # DE: Offline-Bundle. Erst vollstaendig pruefen (Signatur, Pruefsummen,
  #     Versionskette), dann erst entpacken. Schlaegt die Pruefung fehl, bleibt
  #     der Bestand unberuehrt.
  # EN: Offline bundle. Verify completely (signature, checksums, version chain)
  #     before extracting anything. On failure the installation is left untouched.
  printf '   %s %s\n' "$(msg 'Offline-Bundle:' 'Offline bundle:')" "$BUNDLE_FILE"
  ( cd "$SCRIPT_DIR" && docker compose ps backend 2>/dev/null | grep -q "Up\|running" ) \
    || die "$(msg 'backend laeuft nicht - fuer die Bundle-Pruefung zuerst "docker compose up -d" ausfuehren.' 'backend is not running - run "docker compose up -d" first so the bundle can be verified.')"

  printf '   %s' "$(msg 'Signatur und Pruefsummen pruefen ...' 'Verifying signature and checksums ...')"
  ( cd "$SCRIPT_DIR" && docker compose cp "$BUNDLE_FILE" backend:/tmp/update-bundle.tar.gz >/dev/null ) \
    || die "$(msg 'Bundle konnte nicht in den Container kopiert werden.' 'Could not copy the bundle into the container.')"
  VERIFY_OUT=""
  VERIFY_RC=0
  VERIFY_OUT="$( cd "$SCRIPT_DIR" && docker compose exec -T backend \
      python -m app.services.update_bundle /tmp/update-bundle.tar.gz 2>&1 )" || VERIFY_RC=$?
  ( cd "$SCRIPT_DIR" && docker compose exec -T backend rm -f /tmp/update-bundle.tar.gz >/dev/null 2>&1 ) || true

  if [ "$VERIFY_RC" != "0" ]; then
    printf ' %s✗%s\n' "$RED" "$RESET"
    printf '%s\n' "$VERIFY_OUT" >&2
    die "$(msg 'Bundle abgelehnt - es wurde nichts veraendert.' 'Bundle rejected - nothing was changed.')"
  fi
  printf ' %s✓%s\n' "$GREEN" "$RESET"
  printf '%s\n' "$VERIFY_OUT"

  if yesno 'Bundle jetzt einspielen (vorhandene Dateien werden ueberschrieben)?' 'Apply the bundle now (existing files will be overwritten)?' y; then
    TMP_EXTRACT="$(mktemp -d)"
    # DE: .env-Dateien werden vor dem Kopieren entfernt. Die Pruefung weist ein
    #     Bundle mit .env bereits ab; diese Zeile sorgt dafuer, dass die Zusage
    #     unten auch dann stimmt, wenn hier je ein anderer Pruefpfad greift.
    # EN: Remove .env files before copying. Verification already rejects a bundle
    #     containing one; this line keeps the promise below true even if a
    #     different verification path is ever used here.
    if tar -xzf "$BUNDLE_FILE" -C "$TMP_EXTRACT" payload \
       && find "$TMP_EXTRACT/payload" \( -name '.env' -o -name '.env.*' \) -type f -delete \
       && cp -a "$TMP_EXTRACT/payload/." "$SCRIPT_DIR/"; then
      rm -rf "$TMP_EXTRACT"
      printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$(msg 'Bundle eingespielt. Die .env wurde nicht angefasst.' 'Bundle applied. The .env was left untouched.')"
    else
      rm -rf "$TMP_EXTRACT"
      die "$(msg 'Entpacken fehlgeschlagen - Installation pruefen (Backup aus Schritt 2).' 'Extraction failed - check the installation (backup from step 2).')"
    fi
  else
    printf '   %s\n' "$(msg 'Uebersprungen - nichts veraendert.' 'Skipped - nothing changed.')"
    exit 0
  fi
elif [ "$HAVE_GIT" = "1" ]; then
  git -C "$SCRIPT_DIR" fetch --tags --quiet || true
  if BRANCH="$(git -C "$SCRIPT_DIR" symbolic-ref --short -q HEAD)"; then
    UPSTREAM="$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
    if [ -z "$UPSTREAM" ]; then
      printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg "Branch '$BRANCH' hat kein Upstream - uebersprungen." "Branch '$BRANCH' has no upstream - skipped.")"
    else
      AHEAD="$(git -C "$SCRIPT_DIR" rev-list --count "HEAD..$UPSTREAM" 2>/dev/null || echo 0)"
      if [ "$AHEAD" = "0" ]; then
        printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$(msg 'Bereits aktuell.' 'Already up to date.')"
      else
        printf '   %s\n' "$(msg "$AHEAD neue Commit(s) auf $UPSTREAM." "$AHEAD new commit(s) on $UPSTREAM.")"
        if git -C "$SCRIPT_DIR" pull --ff-only --quiet; then
          printf '   %s✓%s %s -> %s\n' "$GREEN" "$RESET" "$(msg 'aktualisiert auf' 'updated to')" "$(git -C "$SCRIPT_DIR" describe --tags --always)"
        else
          die "$(msg 'git pull nicht moeglich (lokale Aenderungen?). Bitte manuell aufloesen.' 'git pull failed (local changes?). Please resolve manually.')"
        fi
      fi
    fi
  else
    # Detached HEAD (auf einem Tag ausgecheckt): neueste Version anzeigen.
    LATEST="$(git -C "$SCRIPT_DIR" tag -l 'v*' --sort=-v:refname | head -n1)"
    printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg "Detached HEAD (fester Tag). Neueste Version: ${LATEST:-?}." "Detached HEAD (pinned tag). Latest version: ${LATEST:-?}.")"
    if [ -n "$LATEST" ] && yesno "Auf $LATEST wechseln?" "Switch to $LATEST?" n; then
      git -C "$SCRIPT_DIR" checkout --quiet "$LATEST" && printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$LATEST"
    fi
  fi
else
  printf '   %s\n' "$(msg 'ZIP-Installation: neue Version manuell herunterladen und entpacken.' 'ZIP install: download and extract the new version manually.')"
fi
printf '\n'

# --- 4. Stack neu bauen/starten / rebuild & restart -------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '4) Stack neu bauen und starten' '4) Rebuild and restart the stack')" "$RESET"
printf '   %s\n' "$(msg 'DB-Migrationen laufen automatisch beim Backend-Start.' 'DB migrations run automatically on backend start.')"
if yesno 'Jetzt "docker compose up -d --build" ausfuehren?' 'Run "docker compose up -d --build" now?' y; then
  ( cd "$SCRIPT_DIR" && docker compose up -d --build )
else
  printf '   %s\n' "$(msg 'Uebersprungen. Spaeter:' 'Skipped. Later:')"
  printf '   %sdocker compose up -d --build%s\n' "$BOLD" "$RESET"
  printf '\n%s\n' "$(msg 'Update beendet (ohne Neustart).' 'Update finished (without restart).')"
  exit 0
fi
printf '\n'

# --- 5. Gesundheit pruefen / health check -----------------------------------
printf '%s%s%s\n' "$BOLD" "$(msg '5) Gesundheit pruefen' '5) Health check')" "$RESET"
OK=0
for _ in $(seq 1 30); do
  if ( cd "$SCRIPT_DIR" && docker compose exec -T backend curl -sf http://localhost:8000/health >/dev/null 2>&1 ); then
    OK=1; break
  fi
  sleep 2
done
if [ "$OK" = "1" ]; then
  printf '   %s✓%s %s\n' "$GREEN" "$RESET" "$(msg 'Backend gesund (/health).' 'Backend healthy (/health).')"
else
  printf '   %s!%s %s\n' "$YELLOW" "$RESET" "$(msg 'Backend noch nicht bereit. Logs: docker compose logs -f backend' 'Backend not ready yet. Logs: docker compose logs -f backend')"
fi
printf '\n'

# --- 6. Hinweis Add-ons / add-on note ---------------------------------------
printf '%s%s%s\n' "$DIM" "$(msg 'Hinweis: Business-/Enterprise-Add-ons haben eigene Releases. In Produktion sind sie Teil des Backend-Images (Rebuild oben genuegt); im Dev-Mount aktualisierst du sie per git pull in ihren Repos + docker compose restart backend.' 'Note: Business/Enterprise add-ons have their own releases. In production they are part of the backend image (the rebuild above covers them); with the dev mount, update them via git pull in their repos + docker compose restart backend.')" "$RESET"
printf '\n%s%s%s\n' "$GREEN$BOLD" "$(msg '✓ Update abgeschlossen.' '✓ Update complete.')" "$RESET"
