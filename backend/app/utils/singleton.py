# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Race-sichere Beschaffung von Singleton-Konfigurationszeilen.

Die Config-Tabellen (SMTP, OIDC, Security, LicenseState) halten genau eine
Zeile. Frueher konnten parallele Requests beim Erstanlegen Duplikate erzeugen;
``first()`` ohne ORDER BY las dann nichtdeterministisch mal die eine, mal die
andere Zeile (z. B. Toggle gespeichert, aber wirkungslos). Ein Unique-Index
auf ``(true)`` laesst nur noch eine Zeile pro Tabelle zu; der Verlierer des
Races liest hier die Zeile des Gewinners.
"""
from typing import Callable, TypeVar

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

T = TypeVar("T")


def get_or_create_singleton(
    db: Session, model: type[T], factory: Callable[[], T] | None = None
) -> T:
    """Liefert die Singleton-Zeile von ``model``; legt sie bei Bedarf an.

    ``factory`` erzeugt die initiale Zeile (z. B. mit .env-Seed); ohne factory
    wird ``model()`` mit den Spalten-Defaults angelegt.
    """
    row = db.query(model).first()
    if row is not None:
        return row
    row = factory() if factory is not None else model()
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        # Paralleler Request hat die Zeile zuerst angelegt -> dessen Zeile lesen.
        db.rollback()
        row = db.query(model).first()
        if row is None:
            raise
        return row
    db.refresh(row)
    return row
