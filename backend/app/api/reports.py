# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Management Report (Open Core): konsolidierte Ansicht + CSV-Export.

Der PDF-Export ist ein Business-Feature und daher hier bewusst nicht enthalten.
"""
import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import ManagementReport
from app.services import reporting

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/management", response_model=ManagementReport)
def management(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return reporting.management_report(db)


@router.get("/management/export")
def management_export(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Denselben Report als CSV (Kennzahlen, Kampagnenvergleich, Top-Durchgefallene)."""
    report = reporting.management_report(db)
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["Management Report"])
    writer.writerow(["Erstellt", report.generated_at.isoformat()])
    writer.writerow([])

    writer.writerow(["Kennzahl", "Wert"])
    for label, value in [
        ("Kampagnen", report.campaigns_total),
        ("Empfaenger", report.recipients),
        ("Versendet", report.sent),
        ("Geoeffnet", report.opened),
        ("Geklickt", report.clicked),
        ("Abgeschickt", report.submitted),
        ("Oeffnungsrate %", report.open_rate),
        ("Klickrate %", report.click_rate),
        ("Submitrate %", report.submit_rate),
        ("Risiko-Score", report.risk_score),
        ("Risiko-Stufe", report.risk_level),
    ]:
        writer.writerow([label, value])
    writer.writerow([])

    writer.writerow(
        ["Kampagne", "Empfaenger", "Versendet", "Geoeffnet", "Geklickt", "Abgeschickt",
         "Oeffnungsrate %", "Klickrate %", "Submitrate %", "Risiko-Score", "Risiko-Stufe"]
    )
    for row in report.campaign_rows:
        writer.writerow(
            [row.name, row.recipients, row.sent, row.opened, row.clicked, row.submitted,
             row.open_rate, row.click_rate, row.submit_rate, row.risk_score, row.risk_level]
        )
    writer.writerow([])

    writer.writerow(["Top Durchgefallene - E-Mail", "Name", "Kampagne", "Status", "Zeit"])
    for f in report.top_failed:
        name = " ".join(x for x in [f.first_name, f.last_name] if x)
        writer.writerow([f.email, name, f.campaign_name, f.status, f.occurred_at.isoformat()])

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=management_report.csv"},
    )
