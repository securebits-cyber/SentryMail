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
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import PrivacyConfig, PrivacyUnlockRequest, PrivacyUnlockStatus, User
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


def active_unlock(
    db: Session, user: User | None, campaign_id: uuid.UUID | None = None
) -> PrivacyUnlockRequest | None:
    """Gueltige Vier-Augen-Freigabe fuer ``user``, sonst ``None``.

    Eine Freigabe wirkt nur fuer ihren Antragsteller und nur bis ``expires_at``.
    Eine kampagnenbezogene Freigabe oeffnet ausschliesslich diese Kampagne; eine
    globale Freigabe (ohne ``campaign_id``) oeffnet alles. Wird hier keine
    Kampagne uebergeben, zaehlt daher nur eine globale Freigabe - eine Ansicht
    ueber alle Kampagnen darf sich nicht aus einer Einzelfreigabe ergeben.
    """
    if user is None:
        return None
    query = db.query(PrivacyUnlockRequest).filter(
        PrivacyUnlockRequest.requested_by_id == user.id,
        PrivacyUnlockRequest.status == PrivacyUnlockStatus.APPROVED,
        PrivacyUnlockRequest.expires_at > datetime.now(timezone.utc),
    )
    if campaign_id is None:
        query = query.filter(PrivacyUnlockRequest.campaign_id.is_(None))
    else:
        query = query.filter(
            or_(
                PrivacyUnlockRequest.campaign_id.is_(None),
                PrivacyUnlockRequest.campaign_id == campaign_id,
            )
        )
    return query.order_by(PrivacyUnlockRequest.expires_at.desc()).first()


def individual_view_allowed(
    db: Session, user: User | None = None, campaign_id: uuid.UUID | None = None
) -> bool:
    """Darf ``user`` gerade Einzelpersonen-Auswertungen sehen?

    Bei ausgeschaltetem Modus immer, sonst nur mit gueltiger, unverfallener
    Vier-Augen-Freigabe. Ohne ``user`` (interne Aufrufe ohne Request-Kontext)
    gilt die Sperre - der sichere Default.
    """
    if not policy(db).mode_enabled:
        return True
    return active_unlock(db, user, campaign_id) is not None


def assert_individual_allowed(
    db: Session, user: User | None = None, campaign_id: uuid.UUID | None = None
) -> None:
    """Bricht mit 403 ab, wenn Einzelpersonen-Auswertungen gesperrt sind."""
    if individual_view_allowed(db, user, campaign_id):
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
