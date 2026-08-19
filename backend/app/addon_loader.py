# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Add-on-Loader (Plugin-Mechanik).

Private Add-on-Pakete (z. B. White-Label) werden nur bei lizenzierten Kunden
installiert. Ein Add-on exponiert einen Entry Point in der Gruppe
``sentrymail.addons`` (Alt-Pakete: ``humanshield.addons``, wird weiterhin
geladen), der auf ein Modul mit ``FEATURE_ID`` und ``register(app)`` zeigt. ``register`` mountet die eigenen Router — jeweils
hinter ``Depends(require_feature(FEATURE_ID))`` (siehe app.services.license).

Ist kein Add-on installiert (unlizenzierter Kunde / reiner Open-Core), passiert
hier nichts. Das Feature-Gate selbst liegt in den Add-on-Routern; dieser Loader
entscheidet nur, ob ein Paket ueberhaupt vorhanden ist.

Siehe docs/license-addon-architektur.md (Abschnitt 6).
"""
import logging
from importlib.metadata import entry_points

logger = logging.getLogger(__name__)

# Neue Gruppe zuerst; die alte HumanShield-Gruppe bleibt geladen, damit bereits
# ausgelieferte Add-on-Pakete nach dem Rebranding weiter funktionieren.
ADDON_GROUPS = ("sentrymail.addons", "humanshield.addons")

#: FEATURE_IDs der Pakete, die beim Start tatsaechlich registriert wurden.
#:
#: Prozessweiter Zustand, weil "ist das Paket installiert?" fuer den ganzen
#: Prozess gilt und weder pro Request noch pro Nutzer variiert. Das Frontend
#: braucht die Angabe, um "nicht lizenziert" von "lizenziert, aber Paket fehlt"
#: zu unterscheiden - ohne sie haengt eine lizenzierte Add-on-Seite ohne Paket
#: dauerhaft im Ladezustand, weil ihr GET ins Leere laeuft.
LOADED_ADDONS: set[str] = set()


def loaded_addons() -> set[str]:
    """FEATURE_IDs der registrierten Add-on-Pakete (Kopie, damit niemand mutiert)."""
    return set(LOADED_ADDONS)


def load_addons(app) -> list[str]:
    """Entdeckt und registriert installierte Add-on-Pakete. Gibt geladene FEATURE_IDs zurueck."""
    loaded: list[str] = []
    discovered = []
    seen_names: set[str] = set()
    for group in ADDON_GROUPS:
        try:
            for ep in entry_points(group=group):
                if ep.name in seen_names:
                    continue  # gleiches Add-on in beiden Gruppen -> nur einmal laden
                seen_names.add(ep.name)
                discovered.append(ep)
        except Exception:  # noqa: BLE001 - Discovery darf den Start nie verhindern
            logger.exception("Add-on-Discovery fehlgeschlagen (Gruppe %s)", group)

    for ep in discovered:
        try:
            module = ep.load()
            register = getattr(module, "register", None)
            feature_id = getattr(module, "FEATURE_ID", ep.name)
            if register is None:
                logger.warning("Add-on '%s' ohne register(app) - uebersprungen", ep.name)
                continue
            register(app)
            loaded.append(feature_id)
            logger.info("Add-on geladen: %s (feature=%s)", ep.name, feature_id)
        except Exception:  # noqa: BLE001 - ein defektes Add-on darf den Core nicht mitnehmen
            logger.exception("Add-on '%s' konnte nicht geladen werden", ep.name)

    if not loaded:
        logger.info("Keine Add-ons installiert (reiner Open-Core-Betrieb)")

    # Ein defektes Add-on ist oben in der Ausnahmebehandlung gelandet und steht
    # deshalb nicht in `loaded` - es gilt hier bewusst als "nicht installiert",
    # damit das Frontend den Installationshinweis zeigt statt eines Formulars,
    # dessen Endpunkte gar nicht gemountet sind.
    LOADED_ADDONS.clear()
    LOADED_ADDONS.update(loaded)
    return loaded
