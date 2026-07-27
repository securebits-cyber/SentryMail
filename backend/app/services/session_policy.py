# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Sitzungsdauer nach Betreiber-Einstellung.

Ohne eingestellte automatische Abmeldung gilt die feste Laufzeit aus der
``.env`` (``ACCESS_TOKEN_EXPIRE_MINUTES``) wie bisher. Ist sie eingestellt,
gilt sie **statt** dessen - und zwar an jeder Stelle, die eine Sitzung
ausstellt. Stuende die Abfrage nur an einer davon, haette der Login eine
andere Laufzeit als die Erneuerung, und die eingestellte Grenze waere beim
ersten Mal wirkungslos.
"""
from sqlalchemy.orm import Session

from app.models import SecurityConfig


def idle_minutes(db: Session) -> int | None:
    """Eingestellte Untaetigkeitsgrenze in Minuten, oder ``None`` wenn aus."""
    config = db.query(SecurityConfig).first()
    if config is None or not config.idle_logout_minutes:
        return None
    return int(config.idle_logout_minutes)
