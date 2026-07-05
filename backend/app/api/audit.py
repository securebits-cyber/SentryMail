# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Audit-Log-Endpunkt (admin-only): Anmelde- und System-Aenderungsereignisse."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin
from app.database import get_db
from app.models import AuditEvent, User
from app.schemas import AuditEventList

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=AuditEventList)
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(AuditEvent).order_by(AuditEvent.created_at.desc())
    total = query.count()
    events = query.offset(offset).limit(limit).all()
    return AuditEventList(total=total, events=events)
