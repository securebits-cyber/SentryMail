# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Versions- und Update-Status fuer das UI.

Liefert die laufende Version (Backend als Single Source of Truth) sowie einen
optionalen Update-Hinweis. Nur fuer eingeloggte Nutzer - der Aufruf triggert
ggf. einen (gecachten) externen Update-Check.
"""
from fastapi import APIRouter, Depends

from app.auth.permissions import get_current_user
from app.models import User
from app.services.update_check import get_update_status

router = APIRouter(tags=["version"])


@router.get("/version")
def get_version(_: User = Depends(get_current_user)) -> dict:
    return get_update_status()
