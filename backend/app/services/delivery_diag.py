# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Diagnose "Warum kam die Mail nicht an" (Welle 9.1, Core).

Beantwortet drei Fragen, die beim Kunden sonst als Supportticket landen:

1. **Steht die Absenderdomain richtig?** SPF, DKIM und DMARC der
   Simulations-Absenderdomain werden per DNS nachgeschlagen und im Klartext
   bewertet.
2. **Was hat der Empfaengerserver gesagt?** Die gespeicherten SMTP-Antworten
   werden nach Statuscode gruppiert.
3. **Ist es Greylisting?** Haeufen sich 4xx-Ablehnungen, ist die Mail nicht
   verloren, sondern verzoegert - eine voellig andere Handlungsempfehlung.

**Das ist eine Zustellungsauswertung, keine Personenauswertung.** Es werden
Statuscodes und Domains ausgewertet, keine Empfaengermerkmale; die
k-Anonymitaetsschwelle aus Welle 2 greift hier deshalb nicht.

Befunde kommen als stabile Codes zurueck, uebersetzt wird im Frontend - sonst
staende deutscher Text in einer englischen Oberflaeche.
"""
from __future__ import annotations

import logging
from collections import Counter

import dns.exception
import dns.resolver
from sqlalchemy.orm import Session

from app.models import Campaign, Recipient
from app.services.campaign import smtp_params

logger = logging.getLogger(__name__)

#: Kurz halten: Die Diagnose laeuft im Request. Ein haengender Resolver darf die
#: Oberflaeche nicht blockieren - ein fehlender Befund ist besser als ein Timeout.
DNS_TIMEOUT = 3.0

#: Ab wie vielen 4xx-Ablehnungen von Greylisting auszugehen ist. Einzelne
#: 4xx sind Alltag; erst die Haeufung ist ein Muster.
GREYLIST_MIN = 3

# Befund-Codes (Vertrag nach aussen, Uebersetzung im Frontend).
SEVERITY_OK = "ok"
SEVERITY_INFO = "info"
SEVERITY_WARN = "warn"
SEVERITY_ERROR = "error"


def _finding(code: str, severity: str, **params) -> dict:
    return {"code": code, "severity": severity, "params": params}


def _txt_records(name: str) -> list[str]:
    """TXT-Eintraege einer Domain. Leer bei jedem DNS-Problem."""
    resolver = dns.resolver.Resolver()
    resolver.timeout = DNS_TIMEOUT
    resolver.lifetime = DNS_TIMEOUT
    try:
        answers = resolver.resolve(name, "TXT")
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        return []
    except dns.exception.DNSException as exc:
        logger.info("DNS-Abfrage fuer %s fehlgeschlagen: %s", name, exc)
        return []
    records = []
    for answer in answers:
        # TXT-Werte kommen in Haeppchen zu 255 Zeichen und muessen zusammengesetzt
        # werden - ein langer SPF-Eintrag ist sonst abgeschnitten und wird
        # faelschlich als fehlerhaft gelesen.
        records.append(b"".join(answer.strings).decode("utf-8", "replace"))
    return records


def check_domain(domain: str) -> list[dict]:
    """SPF-, DMARC- und DKIM-Befunde zu einer Absenderdomain."""
    findings: list[dict] = []
    if not domain:
        return [_finding("domain_unknown", SEVERITY_WARN)]

    spf = [r for r in _txt_records(domain) if r.lower().startswith("v=spf1")]
    if not spf:
        findings.append(_finding("spf_missing", SEVERITY_ERROR, domain=domain))
    elif len(spf) > 1:
        # Mehrere SPF-Eintraege sind laut RFC 7208 ungueltig; viele Empfaenger
        # werten die Domain dann als permerror und lehnen ab.
        findings.append(_finding("spf_multiple", SEVERITY_ERROR, domain=domain))
    else:
        record = spf[0]
        if "-all" in record:
            findings.append(_finding("spf_strict", SEVERITY_INFO, record=record))
        elif "~all" in record:
            findings.append(_finding("spf_softfail", SEVERITY_OK, record=record))
        elif "+all" in record or "?all" in record:
            findings.append(_finding("spf_permissive", SEVERITY_WARN, record=record))
        else:
            findings.append(_finding("spf_no_all", SEVERITY_WARN, record=record))

    dmarc = [r for r in _txt_records(f"_dmarc.{domain}") if r.lower().startswith("v=dmarc1")]
    if not dmarc:
        findings.append(_finding("dmarc_missing", SEVERITY_INFO, domain=domain))
    else:
        policy = "none"
        for part in dmarc[0].split(";"):
            key, _, value = part.strip().partition("=")
            if key.strip().lower() == "p":
                policy = value.strip().lower()
                break
        if policy == "reject":
            findings.append(_finding("dmarc_reject", SEVERITY_WARN, policy=policy))
        elif policy == "quarantine":
            findings.append(_finding("dmarc_quarantine", SEVERITY_WARN, policy=policy))
        else:
            findings.append(_finding("dmarc_none", SEVERITY_OK, policy=policy))

    # DKIM laesst sich ohne den Selektor nicht pruefen - der steht in der
    # Signatur der gesendeten Mail, nicht im DNS der Domain. Lieber sagen, dass
    # es nicht geprueft wurde, als eine Pruefung vortaeuschen.
    findings.append(_finding("dkim_unverifiable", SEVERITY_INFO, domain=domain))
    return findings


def check_deliveries(db: Session, campaign: Campaign) -> tuple[list[dict], dict]:
    """Bounce-Auswertung und Greylisting-Erkennung aus den gespeicherten Antworten."""
    rows = (
        db.query(Recipient.delivery_status, Recipient.delivery_code, Recipient.sent_at)
        .filter(Recipient.campaign_id == campaign.id)
        .all()
    )
    stats = {
        "total": len(rows),
        "sent": sum(1 for r in rows if r.delivery_status == "sent"),
        "deferred": sum(1 for r in rows if r.delivery_status == "deferred"),
        "failed": sum(1 for r in rows if r.delivery_status == "failed"),
        "unknown": sum(1 for r in rows if r.delivery_status is None),
        "codes": dict(Counter(r.delivery_code for r in rows if r.delivery_code).most_common(10)),
    }

    findings: list[dict] = []
    if stats["total"] == 0:
        return [_finding("no_recipients", SEVERITY_INFO)], stats
    if stats["unknown"] == stats["total"]:
        # Vor dieser Version versendet oder noch gar nicht versendet.
        return [_finding("not_sent_yet", SEVERITY_INFO)], stats

    if stats["deferred"] >= GREYLIST_MIN:
        # Wer hier "nicht angekommen" liest, sucht an der falschen Stelle: Die
        # Mail ist verzoegert, nicht verloren.
        findings.append(_finding("greylisting_suspected", SEVERITY_INFO, count=stats["deferred"]))
    elif stats["deferred"] > 0:
        findings.append(_finding("deferred_some", SEVERITY_INFO, count=stats["deferred"]))

    # Ein voruebergehend abgelehnter Empfaenger, der spaeter doch ankam, zeigt
    # Greylisting im Nachhinein - der Befund oben bleibt trotzdem nuetzlich.
    recovered = sum(1 for r in rows if r.delivery_status == "sent" and r.sent_at is not None)
    if stats["deferred"] >= GREYLIST_MIN and recovered:
        findings.append(_finding("greylisting_recovered", SEVERITY_OK, count=recovered))

    if stats["failed"]:
        findings.append(_finding("permanent_failures", SEVERITY_ERROR, count=stats["failed"]))
    if stats["sent"] == stats["total"]:
        findings.append(_finding("all_delivered", SEVERITY_OK, count=stats["sent"]))
    return findings, stats


def sender_domain(db: Session, campaign: Campaign) -> str:
    params = smtp_params(db, campaign)
    from_email = (params.get("from_email") or "").strip()
    return from_email.rsplit("@", 1)[1].lower() if "@" in from_email else ""


def diagnose(db: Session, campaign: Campaign) -> dict:
    """Vollstaendiger Befund zu einer Kampagne."""
    domain = sender_domain(db, campaign)
    delivery_findings, stats = check_deliveries(db, campaign)
    return {
        "campaign_id": str(campaign.id),
        "sender_domain": domain,
        "dns": check_domain(domain),
        "delivery": delivery_findings,
        "stats": stats,
    }
