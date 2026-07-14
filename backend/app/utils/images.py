# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Bild-Hilfsfunktionen fuer den Mailversand.

SVG-Logos werden zwar korrekt in die Mail eingebettet, aber praktisch alle
Mail-Clients (Outlook, Gmail, Apple Mail) rendern Inline-SVG aus
Sicherheitsgruenden nicht. Damit hochgeladene SVG-Logos in E-Mail-Vorlagen
trotzdem erscheinen, werden sie vor dem Versand serverseitig nach PNG gerastert.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def svg_to_png(svg_bytes: bytes) -> bytes | None:
    """Rastert ein SVG (Rohbytes) nach PNG.

    Gibt die PNG-Bytes zurueck oder ``None``, wenn keine Rasterbibliothek
    verfuegbar ist oder die Konvertierung fehlschlaegt. Der Aufrufer laesst das
    Logo dann bewusst weg, statt den Versand abzubrechen.
    """
    try:
        import cairosvg  # lokal importiert: optionale, schwergewichtige Abhaengigkeit
    except Exception as e:  # noqa: BLE001
        logger.warning("SVG-Logo kann nicht konvertiert werden (cairosvg fehlt): %s", e)
        return None
    try:
        return cairosvg.svg2png(bytestring=svg_bytes)
    except Exception as e:  # noqa: BLE001
        logger.warning("SVG->PNG-Konvertierung fehlgeschlagen: %s", e)
        return None
