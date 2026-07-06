# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Template-Rendering fuer Kampagnen-Mails.

Platzhalter-Hook: Add-ons koennen zusaetzliche Template-Variablen bereitstellen
(z. B. ``{{ qr_code }}`` im Quishing-Add-on), ohne dass der Core deren Logik
kennt. Ein Provider bekommt den Render-Kontext und liefert einen String zurueck.
Ohne registriertes Add-on bleibt der Platzhalter leer (Jinja-Undefined -> "").
"""
from collections.abc import Callable

from jinja2 import Template

_placeholder_providers: dict[str, Callable[[dict], str]] = {}


def register_placeholder(name: str, provider: Callable[[dict], str]) -> None:
    """Registriert einen Template-Platzhalter (von Add-ons aufgerufen)."""
    _placeholder_providers[name] = provider


def extra_placeholders(ctx: dict) -> dict:
    """Werte aller registrierten Platzhalter fuer den gegebenen Render-Kontext."""
    return {name: provider(ctx) for name, provider in _placeholder_providers.items()}


def render_template(html_content: str, recipient_name: str, recipient_email: str, click_link: str) -> str:
    ctx = {
        "recipient_name": recipient_name,
        "recipient_email": recipient_email,
        "click_link": click_link,
    }
    ctx.update(extra_placeholders(ctx))
    return Template(html_content).render(**ctx)
