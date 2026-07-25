# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Durchsetzung des Datenschutz-/Mitbestimmungs-Modus (Welle 2).

Eine einzige autoritative Stelle fuer beide Schutzmechanismen, damit Core und
Add-ons dieselbe Regel anwenden - eine Sperre, die je Endpunkt neu formuliert
wird, ist keine:

* **Einzelpersonen-Sperre** - bei aktivem Modus liefert die API keine
  personenbezogenen Auswertungen mehr aus. Aufhebbar nur ueber die
  Vier-Augen-Freigabe (siehe ``individual_view_allowed``).
* **k-Anonymitaet** - Gruppenauswertungen werden erst ab ``k`` beteiligten
  Personen ausgegeben. Unterhalb der Schwelle wird die Gruppe **nicht**
  weggelassen, sondern als unterdrueckt markiert: sonst merkt der Auswerter
  nicht, dass Zahlen fehlen, und das Ergebnis waere im Audit wertlos.

Gezaehlt werden immer **Personen**, nie Ereignisse. Drei Klicks derselben
Person sind eine Person - ein ereignisbasierter Schwellenwert liesse sich durch
mehrfaches Klicken aushebeln.
"""
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import PrivacyConfig, User
from app.utils.singleton import get_or_create_singleton

#: Stabiler Fehlercode, an dem das Frontend die Sperre von einer fehlenden
#: Berechtigung unterscheidet (und die Freigabe anbieten kann).
INDIVIDUAL_LOCKED_CODE = "privacy_individual_locked"


@dataclass(frozen=True)
class PrivacyPolicy:
    """Momentaufnahme der geltenden Policy - ein DB-Zugriff pro Request."""

    mode_enabled: bool
    k: int
    fingerprinting_enabled: bool


def policy(db: Session) -> PrivacyPolicy:
    config: PrivacyConfig = get_or_create_singleton(db, PrivacyConfig)
    return PrivacyPolicy(
        mode_enabled=config.privacy_mode_enabled,
        k=config.k_anonymity_threshold,
        fingerprinting_enabled=config.fingerprinting_enabled,
    )


def individual_view_allowed(db: Session, user: User | None = None) -> bool:
    """Darf ``user`` gerade Einzelpersonen-Auswertungen sehen?

    Bei ausgeschaltetem Modus immer. Bei aktivem Modus nur mit gueltiger
    Vier-Augen-Freigabe - die kommt in Schritt A3 hinzu; bis dahin sperrt der
    Modus ausnahmslos. ``user`` steht hier bereits in der Signatur, damit die
    Aufrufstellen sich dann nicht noch einmal aendern muessen.
    """
    return not policy(db).mode_enabled


def assert_individual_allowed(db: Session, user: User | None = None) -> None:
    """Bricht mit 403 ab, wenn Einzelpersonen-Auswertungen gesperrt sind."""
    if individual_view_allowed(db, user):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": INDIVIDUAL_LOCKED_CODE,
            "message": (
                "Einzelpersonen-Auswertungen sind im Datenschutzmodus gesperrt. "
                "Eine Aufhebung ist nur im Vier-Augen-Verfahren moeglich."
            ),
        },
    )


def below_threshold(persons: int, pol: PrivacyPolicy) -> bool:
    """Ob eine Gruppe mit ``persons`` Beteiligten unterdrueckt werden muss."""
    return pol.mode_enabled and persons < pol.k
