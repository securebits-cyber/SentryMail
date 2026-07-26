# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Allowlisting-Generator (Welle 9.1).

Der Kern ist nicht das Rendern selbst, sondern dass die ausgelieferten
Profildateien gueltig bleiben: Sie sind pflegbare Daten, an denen jemand ohne
Codekenntnis arbeitet - ein Tippfehler darf nicht erst beim Kunden auffallen.
"""
import json

import pytest

from app.models import UserRole
from app.services.delivery_profiles import (
    KNOWN_INPUTS,
    PROFILE_DIR,
    ProfileError,
    get_profile,
    load_profiles,
    render,
    reset_cache,
)

VALUES = {
    "sender_domain": "sim.example.de",
    "sender_ips": "203.0.113.10",
    "tracking_domain": "awareness.example.de",
}


@pytest.fixture(autouse=True)
def _fresh_cache():
    reset_cache()
    yield
    reset_cache()


# --- Ausgelieferte Profile --------------------------------------------------


def test_shipped_profiles_load():
    profiles = load_profiles()
    ids = [p["id"] for p in profiles]
    # Die fuenf aus der Roadmap. Kommen weitere dazu, ist nur diese Zeile zu
    # erweitern - das ist der Punkt der Datendateien.
    assert set(ids) >= {"m365", "postfix", "proofpoint", "sophos", "barracuda"}
    orders = [p["order"] for p in profiles]
    assert orders == sorted(orders), "Profile muessen nach order sortiert kommen"


@pytest.mark.parametrize("path", sorted(PROFILE_DIR.glob("*.json")), ids=lambda p: p.stem)
def test_every_profile_is_wellformed(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["id"] == path.stem, "id muss dem Dateinamen entsprechen"
    assert set(data["label"]) == {"de", "en"}, "Label zweisprachig"
    assert set(data.get("inputs", [])) <= set(KNOWN_INPUTS)
    assert data["snippets"], "mindestens ein Snippet"

    for snippet in data["snippets"]:
        assert set(snippet["title"]) == {"de", "en"}
        kind = snippet.get("kind", "code")
        if kind == "code":
            assert snippet.get("code"), f"{snippet['id']}: code fehlt"
        else:
            assert set(snippet["steps"]) == {"de", "en"}
            assert len(snippet["steps"]["de"]) == len(snippet["steps"]["en"]), (
                "DE und EN muessen gleich viele Schritte haben - sonst fehlt einer Sprache ein Schritt"
            )
        if snippet.get("note"):
            assert set(snippet["note"]) == {"de", "en"}


@pytest.mark.parametrize("path", sorted(PROFILE_DIR.glob("*.json")), ids=lambda p: p.stem)
def test_profile_placeholders_are_declared(path):
    """Jeder Platzhalter im Text muss in ``inputs`` stehen.

    Sonst gaebe es einen Platzhalter, den die Oberflaeche gar nicht abfragt -
    er bliebe unersetzt im kopierten Befehl stehen.
    """
    import re

    data = json.loads(path.read_text(encoding="utf-8"))
    declared = set(data.get("inputs", []))
    text = json.dumps(data, ensure_ascii=False)
    used = set(re.findall(r"\{\{(\w+)\}\}", text))
    assert used <= declared, f"nicht deklariert: {sorted(used - declared)}"
    assert declared <= used, f"deklariert, aber ungenutzt: {sorted(declared - used)}"


# --- Rendern ----------------------------------------------------------------


def test_render_substitutes_all_placeholders():
    result = render("m365", VALUES)
    assert result["missing_inputs"] == []
    code = result["snippets"][0]["code"]
    assert "sim.example.de" in code and "203.0.113.10" in code
    assert "{{" not in code


def test_powershell_variables_survive():
    """PowerShell nutzt $var - das darf die Ersetzung nicht anfassen."""
    code = render("m365", VALUES)["snippets"][0]["code"]
    assert "$true" in code


def test_unfilled_placeholder_stays_visible():
    """Sichtbar stehen lassen statt still leeren: Eine Konfigurationszeile mit
    einem stillen Loch wird kopiert und faellt erst beim Kunden auf."""
    result = render("postfix", {"sender_domain": "sim.example.de"})
    assert result["missing_inputs"] == ["sender_ips"]
    assert "{{sender_ips}}" in result["snippets"][0]["code"]


def test_steps_are_rendered_in_both_languages():
    result = render("proofpoint", VALUES)
    snippet = next(s for s in result["snippets"] if s["kind"] == "steps")
    assert "sim.example.de" in " ".join(snippet["steps"]["de"])
    assert "sim.example.de" in " ".join(snippet["steps"]["en"])


def test_newlines_in_input_are_stripped():
    """Ein Umbruch im Wert erzeugte sonst stillschweigend eine zweite Direktive."""
    result = render("postfix", {**VALUES, "sender_ips": "203.0.113.10\nOK\nboese.example"})
    code = result["snippets"][0]["code"]
    assert "203.0.113.10 OK boese.example" in code
    assert code.count("\n") == render("postfix", VALUES)["snippets"][0]["code"].count("\n")


def test_overlong_input_is_truncated():
    result = render("postfix", {**VALUES, "sender_domain": "a" * 500})
    assert "a" * 201 not in json.dumps(result)


def test_unknown_gateway_raises():
    with pytest.raises(ProfileError, match="Unbekanntes Gateway"):
        get_profile("gibt-es-nicht")


# --- API --------------------------------------------------------------------


def test_gateways_endpoint_prefills_from_instance(client, db, make_user, auth_headers):
    from app.services.smtp_config import get_or_create_smtp_config

    smtp = get_or_create_smtp_config(db)
    smtp.from_email = "phish@sim.example.de"
    db.commit()

    user = make_user(email="deliv-user@example.com", role=UserRole.USER)
    res = client.get("/delivery/gateways", headers=auth_headers(user))
    assert res.status_code == 200
    body = res.json()
    assert body["defaults"]["sender_domain"] == "sim.example.de"
    # Die Absender-IP kennt nur der Betreiber - nichts erfinden.
    assert body["defaults"]["sender_ips"] == ""
    assert {g["id"] for g in body["gateways"]} >= {"m365", "postfix"}


def test_allowlist_requires_admin(client, make_user, auth_headers):
    """Die Ausgabe beschreibt, wie der Schutz des Gateways ausgesetzt wird -
    das ist keine Information fuer jeden angemeldeten Nutzer."""
    user = make_user(email="deliv-plain@example.com", role=UserRole.USER)
    res = client.post("/delivery/allowlist", json={"gateway": "m365", "inputs": VALUES}, headers=auth_headers(user))
    assert res.status_code == 403


def test_allowlist_endpoint_renders(client, make_user, auth_headers):
    admin = make_user(email="deliv-admin@example.com")
    res = client.post("/delivery/allowlist", json={"gateway": "m365", "inputs": VALUES}, headers=auth_headers(admin))
    assert res.status_code == 200
    assert "sim.example.de" in res.json()["snippets"][0]["code"]


def test_allowlist_unknown_gateway_is_404(client, make_user, auth_headers):
    admin = make_user(email="deliv-admin2@example.com")
    res = client.post("/delivery/allowlist", json={"gateway": "nope", "inputs": {}}, headers=auth_headers(admin))
    assert res.status_code == 404


# --- Robustheit -------------------------------------------------------------


def test_broken_profile_does_not_disable_the_others(tmp_path, monkeypatch):
    """Ein Tippfehler in einem Profil darf nicht den ganzen Assistenten kippen."""
    from app.services import delivery_profiles as svc

    good = {
        "id": "gut",
        "order": 1,
        "label": {"de": "Gut", "en": "Good"},
        "inputs": ["sender_domain"],
        "snippets": [{"id": "s", "title": {"de": "T", "en": "T"}, "kind": "code", "code": "{{sender_domain}}"}],
    }
    (tmp_path / "gut.json").write_text(json.dumps(good))
    (tmp_path / "kaputt.json").write_text("{ das ist kein json")
    monkeypatch.setattr(svc, "PROFILE_DIR", tmp_path)
    reset_cache()

    assert [p["id"] for p in load_profiles()] == ["gut"]
