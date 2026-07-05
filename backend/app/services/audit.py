"""Audit-Log-Helfer: Anmelde- und System-Aenderungsereignisse aufzeichnen.

Fehler beim Schreiben eines Audit-Ereignisses duerfen den eigentlichen
Vorgang (Login, Speichern) niemals brechen.
"""
from __future__ import annotations

import logging

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditEvent, User

logger = logging.getLogger(__name__)


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    # Hinter Caddy: echte Client-IP steht in X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def record_audit(
    db: Session,
    *,
    action: str,
    description: str,
    category: str = "system",
    actor: User | None = None,
    actor_email: str | None = None,
    ip: str | None = None,
) -> None:
    try:
        event = AuditEvent(
            actor_id=actor.id if actor else None,
            actor_email=(actor.email if actor else actor_email) or "",
            actor_name=actor.full_name if actor else "",
            category=category,
            action=action,
            description=description,
            ip=ip,
        )
        db.add(event)
        db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Audit-Ereignis '%s' konnte nicht gespeichert werden", action)
        db.rollback()
