# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zentrale Versionsangabe der Anwendung.

Wird von release-please bei jedem Release automatisch aktualisiert
(siehe release-please-config.json -> extra-files). Nicht manuell aendern.
Das Frontend zeigt die laufende Version ueber /version an (Backend als
Single Source of Truth), damit sie sich nach jedem Deploy automatisch
aktualisiert statt an einer einkompilierten Konstante zu haengen.
"""

APP_VERSION = "0.20.1"  # x-release-please-version
