#!/bin/sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

# Holt die lizenzierten Add-on-Pakete und startet danach die Anwendung.
#
# Warum vor dem Start und nicht zur Laufzeit: Add-ons registrieren sich ueber
# Python-Entry-Points, und die liest der Interpreter beim Prozessstart. Ein
# nachtraeglich installiertes Paket bliebe bis zum naechsten Neustart unsichtbar.
#
# Kein "set -e" um den Paketbezug: Ein Fehlschlag dort darf den Start NIE
# verhindern - sonst legt ein Ausfall des Lizenzservers jede Kundeninstallation
# still. fetch_addons.py endet ohnehin immer mit 0; das "|| true" ist der
# Guertel zum Hosentraeger.

set -eu

python /app/scripts/fetch_addons.py || true

# exec, damit uvicorn PID 1 wird und Signale von Docker direkt empfaengt.
# Ohne exec liefe die Shell als PID 1 weiter und "docker stop" endete im
# harten Kill nach Ablauf der Frist, statt in einem sauberen Herunterfahren.
exec "$@"
