# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer das Jinja-Template-Rendering der Kampagnen-Mails."""
from app.services.template import render_template


def test_personalization_variables_substituted():
    html = "<p>Hallo {{ recipient_name }} ({{ recipient_email }})</p>"
    out = render_template(
        html,
        recipient_name="Erika Mustermann",
        recipient_email="erika@example.com",
        click_link="https://tracker.example.com/track/click?t=abc",
    )
    assert "Erika Mustermann" in out
    assert "erika@example.com" in out
    assert "{{" not in out


def test_click_link_injected():
    html = '<a href="{{ click_link }}">Jetzt handeln</a>'
    out = render_template(
        html,
        recipient_name="X",
        recipient_email="x@example.com",
        click_link="https://tracker.example.com/track/click?t=xyz",
    )
    assert 'href="https://tracker.example.com/track/click?t=xyz"' in out


def test_plain_template_without_variables_unchanged():
    html = "<p>Statischer Inhalt</p>"
    out = render_template(html, recipient_name="X", recipient_email="x@example.com", click_link="l")
    assert out == html
