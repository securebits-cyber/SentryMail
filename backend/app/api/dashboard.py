# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Aggregierte Uebersicht: KPIs, Risikobewertung, Zeitachse, Durchgefallene.

Die Berechnungen liegen im Reporting-Service (app.services.reporting), damit
Dashboard und Management Report dieselbe Logik teilen.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import DashboardSummary, FailedRecipient, RiskSummary, TimelinePoint
from app.services import reporting

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return reporting.overall_summary(db)


@router.get("/failed", response_model=list[FailedRecipient])
def failed_recipients(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return reporting.failed_recipients(db)


@router.get("/risk", response_model=RiskSummary)
def risk(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return reporting.compute_risk(db)


@router.get("/timeline", response_model=list[TimelinePoint])
def timeline(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return reporting.timeline(db)
