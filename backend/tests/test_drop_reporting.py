# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""USB-Drops in der Auswertung getrennt von Mail-Kampagnen.

Der Kern ist nicht die Darstellung, sondern die Rechnung: Ein Fundort ist kein
Empfaenger und erst recht keine Person. Lief er mit, verschob er jede Rate und
tauchte in der personenbezogenen Rangliste als "Parkplatz" auf.

Erkannt wird eine Drop-Kampagne am Merkmal ihrer Empfaengerzeilen (Adresse auf
``.invalid``, RFC 2606) - nicht am Kanal. Der Kanal gehoert zum
Enterprise-Add-on, und die Auswertung im Core darf davon nicht abhaengen.
"""
import pytest

from app.models import Campaign, Recipient, Template, TrackingEvent, TrackingEventType
from app.services import reporting
from app.utils.security import generate_tracking_token


@pytest.fixture
def owner(make_user):
    return make_user(email="drop-report-owner@example.de")


@pytest.fixture
def template(db, owner):
    row = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _campaign(db, owner, template, name):
    row = Campaign(name=name, template_id=template.id, created_by_id=owner.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _recipient(db, campaign, email, first_name="", clicked=False, opened=False):
    r = Recipient(
        campaign_id=campaign.id,
        email=email,
        first_name=first_name,
        tracking_token=generate_tracking_token(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    for hit, kind in ((opened, TrackingEventType.OPENED), (clicked, TrackingEventType.CLICKED)):
        if hit:
            db.add(TrackingEvent(recipient_id=r.id, event_type=kind))
    db.commit()
    return r


@pytest.fixture
def two_campaigns(db, owner, template):
    """Eine Mail-Kampagne und ein USB-Drop, beide mit einem Treffer."""
    mail = _campaign(db, owner, template, "Mail-Kampagne")
    _recipient(db, mail, "person@example.de", "Erika", clicked=True, opened=True)
    _recipient(db, mail, "zweite@example.de", "Klaus")

    drop = _campaign(db, owner, template, "Datentraeger Q3")
    _recipient(db, drop, "drop-001-aa@usb-drop.invalid", "Parkplatz", clicked=True)
    _recipient(db, drop, "drop-002-bb@usb-drop.invalid", "Empfang")
    return mail, drop


# --- Erkennung --------------------------------------------------------------


def test_a_campaign_of_placeholders_is_recognised_as_a_drop(db, two_campaigns):
    mail, drop = two_campaigns
    ids = reporting.drop_campaign_ids(db)
    assert drop.id in ids
    assert mail.id not in ids


def test_one_real_address_makes_it_a_mail_campaign(db, owner, template):
    """Sicherheitsnetz gegen eine zu eifrige Erkennung: Sobald eine echte
    Adresse dabei ist, wird die Kampagne normal ausgewertet."""
    mixed = _campaign(db, owner, template, "Gemischt")
    _recipient(db, mixed, "drop-001@usb-drop.invalid", "Parkplatz")
    _recipient(db, mixed, "echt@example.de", "Erika")
    assert mixed.id not in reporting.drop_campaign_ids(db)


# --- Kennzahlen -------------------------------------------------------------


def test_the_dashboard_counts_the_two_kinds_apart(db, two_campaigns):
    summary = reporting.overall_summary(db)
    assert summary.campaigns == 1        # nur die Mail-Kampagne
    assert summary.recipients == 2       # nur echte Empfaenger
    assert summary.clicked == 1
    assert summary.drops.campaigns == 1
    assert summary.drops.media == 2      # zwei Fundorte
    assert summary.drops.opened == 1


def test_drops_do_not_move_the_mail_rates(db, two_campaigns):
    """Die eigentliche Gefahr des Zusammenzaehlens: Zwei nie geoeffnete
    Datentraeger druecken sonst die Oeffnungsrate der Mail-Kampagne."""
    report = reporting.management_report(db)
    assert report.recipients == 2
    assert report.open_rate == 50  # 1 von 2 echten Empfaengern


def test_every_campaign_row_states_its_kind(db, two_campaigns):
    mail, drop = two_campaigns
    kinds = {r.campaign_id: r.kind for r in reporting.management_report(db).campaign_rows}
    assert kinds[mail.id] == "mail"
    assert kinds[drop.id] == "drop"


# --- Personenbezogene Auswertungen ------------------------------------------


def test_a_location_is_never_listed_as_a_person(db, two_campaigns):
    """Ein USB-Drop kennt niemanden. Stuende der Fundort in der Rangliste,
    behauptete die Auswertung eine Person, die es nicht gibt."""
    people = reporting.human_risk(db, for_automation=True).top_people
    assert all("usb-drop.invalid" not in p.email for p in people)
    assert all(p.first_name != "Parkplatz" for p in people)


def test_a_location_is_not_among_the_failed(db, two_campaigns):
    failed = reporting.failed_recipients(db)
    assert all("usb-drop.invalid" not in f.email for f in failed)
    assert any(f.email == "person@example.de" for f in failed)


# --- Abgrenzung zur Anonymisierung ------------------------------------------


def test_anonymised_people_are_not_mistaken_for_media(db, owner, template):
    """Die Aufbewahrungsfrist schreibt Adressen ebenfalls auf ``.invalid`` um.

    Dort *stand* aber eine Person, und ihre Statistik gehoert weiter in die
    Mail-Zahlen. Ohne diese Abgrenzung waere eine vollstaendig anonymisierte
    Kampagne ploetzlich ein Datentraeger - und ihre Kennzahlen aus der
    Auswertung verschwunden, ohne dass jemand etwas geloescht haette.
    """
    from datetime import datetime, timezone

    campaign = _campaign(db, owner, template, "Anonymisiert")
    for i in range(2):
        r = _recipient(db, campaign, f"anonym-{i}@anonymisiert.invalid", "", clicked=True)
        r.anonymized_at = datetime.now(timezone.utc)
    db.commit()

    assert campaign.id not in reporting.drop_campaign_ids(db)
    summary = reporting.overall_summary(db)
    assert summary.recipients == 2
    assert summary.drops.media == 0
