"""Eigenes Profil des angemeldeten Nutzers: Name/Passwort + 2FA-Verwaltung."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.settings import get_or_create_security_config
from app.auth.permissions import get_current_user, get_user_for_2fa_setup
from app.database import get_db
from app.models import User
from app.schemas import (
    TotpSetupOut,
    TwoFAActivated,
    TwoFACodeIn,
    TwoFADisableIn,
    TwoFAEmailSetupResult,
    TwoFAStatus,
    UserOut,
)
from app.services import twofa
from app.services.audit import client_ip, record_audit
from app.utils.crypto import decrypt, encrypt
from app.utils.passwords import hash_password, verify_password
from app.utils.security import create_access_token

router = APIRouter(prefix="/me", tags=["me"])


class MeUpdate(BaseModel):
    full_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None


@router.get("", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("", response_model=UserOut)
def update_me(payload: MeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.new_password:
        # Ist bereits ein Passwort gesetzt (lokaler Login), muss das aktuelle stimmen.
        if current_user.password_hash is not None:
            if not payload.current_password or not verify_password(
                payload.current_password, current_user.password_hash
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Aktuelles Passwort ist falsch"
                )
        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user


# ---------------- 2FA ----------------

def _clear_twofa(user: User) -> None:
    user.twofa_method = None
    user.totp_secret_encrypted = None
    user.totp_pending_secret_encrypted = None
    user.twofa_backup_codes = None
    twofa.clear_email_code(user)


@router.get("/2fa", response_model=TwoFAStatus)
def twofa_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    policy = get_or_create_security_config(db).require_2fa
    return TwoFAStatus(
        method=user.twofa_method,
        enabled=user.twofa_enabled,
        backup_codes_remaining=twofa.backup_codes_remaining(user),
        required=twofa.twofa_required_for(user, policy),
    )


@router.post("/2fa/totp/setup", response_model=TotpSetupOut)
def totp_setup(db: Session = Depends(get_db), user: User = Depends(get_user_for_2fa_setup)):
    secret = twofa.new_totp_secret()
    user.totp_pending_secret_encrypted = encrypt(secret)
    db.commit()
    uri = twofa.provisioning_uri(secret, user.email)
    return TotpSetupOut(secret=secret, provisioning_uri=uri, qr_data_uri=twofa.qr_data_uri(uri))


@router.post("/2fa/totp/confirm", response_model=TwoFAActivated)
def totp_confirm(
    payload: TwoFACodeIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_for_2fa_setup),
):
    if not user.totp_pending_secret_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Keine TOTP-Einrichtung offen. Bitte neu starten.")
    if not twofa.verify_totp(decrypt(user.totp_pending_secret_encrypted), payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code ist ungültig.")
    user.totp_secret_encrypted = user.totp_pending_secret_encrypted
    user.totp_pending_secret_encrypted = None
    user.twofa_method = "totp"
    codes = twofa.generate_backup_codes()
    twofa.set_backup_codes(user, codes)
    db.commit()
    record_audit(db, action="twofa.enabled", description="Zwei-Faktor-Authentifizierung (App) aktiviert", actor=user, ip=client_ip(request))
    return TwoFAActivated(backup_codes=codes, access_token=create_access_token(subject=str(user.id)))


@router.post("/2fa/email/setup", response_model=TwoFAEmailSetupResult)
def email_setup(db: Session = Depends(get_db), user: User = Depends(get_user_for_2fa_setup)):
    code = twofa.new_email_code()
    twofa.set_email_code(user, code)
    db.commit()
    ok, detail = twofa.send_email_2fa_code(db, user, code)
    return TwoFAEmailSetupResult(
        success=ok,
        detail="Code per E-Mail gesendet." if ok else f"Versand fehlgeschlagen: {detail}",
    )


@router.post("/2fa/email/confirm", response_model=TwoFAActivated)
def email_confirm(
    payload: TwoFACodeIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_user_for_2fa_setup),
):
    if not twofa.verify_email_code(user, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code ist ungültig oder abgelaufen.")
    twofa.clear_email_code(user)
    user.twofa_method = "email"
    codes = twofa.generate_backup_codes()
    twofa.set_backup_codes(user, codes)
    db.commit()
    record_audit(db, action="twofa.enabled", description="Zwei-Faktor-Authentifizierung (E-Mail) aktiviert", actor=user, ip=client_ip(request))
    return TwoFAActivated(backup_codes=codes, access_token=create_access_token(subject=str(user.id)))


@router.post("/2fa/disable", status_code=status.HTTP_204_NO_CONTENT)
def twofa_disable(
    payload: TwoFADisableIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwort ist falsch.")
    policy = get_or_create_security_config(db).require_2fa
    if twofa.twofa_required_for(user, policy):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA ist für dein Konto verpflichtend und kann nicht deaktiviert werden.",
        )
    _clear_twofa(user)
    db.commit()
    record_audit(db, action="twofa.disabled", description="Zwei-Faktor-Authentifizierung deaktiviert", actor=user, ip=client_ip(request))


@router.post("/2fa/backup-codes/regenerate", response_model=TwoFAActivated)
def regenerate_backup_codes(
    payload: TwoFADisableIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user.twofa_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA ist nicht aktiv.")
    if user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwort ist falsch.")
    codes = twofa.generate_backup_codes()
    twofa.set_backup_codes(user, codes)
    db.commit()
    record_audit(db, action="twofa.backup_regenerated", description="Backup-Codes neu erzeugt", actor=user, ip=client_ip(request))
    return TwoFAActivated(backup_codes=codes)
