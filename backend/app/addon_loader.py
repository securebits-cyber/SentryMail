# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Add-on-Loader (Plugin-Mechanik).

Private Add-on-Pakete (z. B. White-Label) werden nur bei lizenzierten Kunden
installiert. Ein Add-on exponiert einen Entry Point in der Gruppe
``humanshield.addons``, der auf ein Modul mit ``FEATURE_ID`` und
``register(app)`` zeigt. ``register`` mountet die eigenen Router — jeweils
hinter ``Depends(require_feature(FEATURE_ID))`` (siehe app.services.license).

Ist kein Add-on installiert (unlizenzierter Kunde / reiner Open-Core), passiert
hier nichts. Das Feature-Gate selbst liegt in den Add-on-Routern; dieser Loader
entscheidet nur, ob ein Paket ueberhaupt vorhanden ist.

Siehe docs/lizenz-addon-architektur.md (Abschnitt 6).
"""
import logging
from importlib.metadata import entry_points

logger = logging.getLogger(__name__)

ADDON_GROUP = "humanshield.addons"


def load_addons(app) -> list[str]:
    """Entdeckt und registriert installierte Add-on-Pakete. Gibt geladene FEATURE_IDs zurueck."""
    loaded: list[str] = []
    try:
        discovered = entry_points(group=ADDON_GROUP)
    except Exception:  # noqa: BLE001 - Discovery darf den Start nie verhindern
        logger.exception("Add-on-Discovery fehlgeschlagen")
        return loaded

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
    return loaded
