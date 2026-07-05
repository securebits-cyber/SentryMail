# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Lizenz-/Feature-Endpunkte.

`/features` liefert dem Frontend die aktiven Entitlements (jeder eingeloggte
Nutzer). Die `/license`-Endpunkte (Status, Schluessel setzen, jetzt pruefen)
sind admin-only.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user, require_admin
from app.database import get_db
from app.models import User
from app.services import license as license_service

router = APIRouter(tags=["license"])


class LicenseKeyIn(BaseModel):
    license_key: str


@router.get("/features")
def get_features(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    return license_service.features_map(db)


@router.get("/license")
def get_license(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    return license_service.license_status(db)


@router.put("/license")
def set_license(
    payload: LicenseKeyIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    license_service.set_license_key(db, payload.license_key)
    return license_service.license_status(db)


@router.post("/license/refresh")
def refresh_license(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    license_service.refresh_license(db)
    return license_service.license_status(db)
