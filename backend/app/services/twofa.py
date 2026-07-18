# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""2FA-Kernlogik: TOTP (Authenticator-App), E-Mail-Einmalcodes, Backup-Codes, QR.

Secrets liegen verschluesselt (Fernet) im User; Backup-Codes nur als SHA-256-Hash.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone

import pyotp
import segno
from sqlalchemy.orm import Session

from app.models import User
from app.services.mail import send_simple_email
from app.services.smtp_config import get_or_create_smtp_config
from app.utils.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)

ISSUER = "SentryMail"
BACKUP_CODE_COUNT = 8
EMAIL_CODE_TTL_MINUTES = 10


# ---------- Backup-Codes ----------
def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().encode()).hexdigest()


def generate_backup_codes(n: int = BACKUP_CODE_COUNT) -> list[str]:
    return [f"{(raw := secrets.token_hex(5))[:5]}-{raw[5:]}" for _ in range(n)]


def set_backup_codes(user: User, codes: list[str]) -> None:
    user.twofa_backup_codes = json.dumps([_hash_code(c) for c in codes])


def backup_codes_remaining(user: User) -> int:
    if not user.twofa_backup_codes:
        return 0
    try:
        return len(json.loads(user.twofa_backup_codes))
    except (ValueError, TypeError):
        return 0


def consume_backup_code(user: User, code: str) -> bool:
    if not user.twofa_backup_codes:
        return False
    try:
        hashes = json.loads(user.twofa_backup_codes)
    except (ValueError, TypeError):
        return False
    target = _hash_code(code)
    match = next((h for h in hashes if hmac.compare_digest(h, target)), None)
    if match is None:
        return False
    hashes.remove(match)
    user.twofa_backup_codes = json.dumps(hashes)
    return True


# ---------- TOTP ----------
def new_totp_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)


def qr_data_uri(uri: str) -> str:
    return segno.make(uri, error="m").svg_data_uri(scale=5, border=2)


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


# ---------- E-Mail-Einmalcode ----------
def new_email_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def set_email_code(user: User, code: str) -> None:
    user.twofa_email_code_hash = _hash_code(code)
    user.twofa_email_code_expires = datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_TTL_MINUTES)


def clear_email_code(user: User) -> None:
    user.twofa_email_code_hash = None
    user.twofa_email_code_expires = None


def verify_email_code(user: User, code: str) -> bool:
    if not user.twofa_email_code_hash or not user.twofa_email_code_expires:
        return False
    expires = user.twofa_email_code_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        return False
    return hmac.compare_digest(user.twofa_email_code_hash, _hash_code(code))


def send_email_2fa_code(db: Session, user: User, code: str) -> tuple[bool, str]:
    cfg = get_or_create_smtp_config(db)
    if not cfg.host:
        return False, "Kein SMTP konfiguriert"
    password = decrypt(cfg.password_encrypted) if cfg.password_encrypted else None
    try:
        asyncio.run(
            send_simple_email(
                host=cfg.host,
                port=cfg.port,
                tls_mode=cfg.tls_mode,
                validate_certs=cfg.verify_ssl,
                username=cfg.username or None,
                password=password,
                from_email=cfg.from_email,
                from_name=cfg.from_name or ISSUER,
                to_email=user.email,
                subject=f"Ihr Anmeldecode für {ISSUER}",
                text_body=(
                    f"Ihr Anmeldecode lautet: {code}\n\n"
                    f"Er ist {EMAIL_CODE_TTL_MINUTES} Minuten gültig. "
                    "Wenn Sie sich nicht anmelden wollten, ändern Sie bitte Ihr Passwort."
                ),
            )
        )
        return True, "gesendet"
    except Exception as e:  # noqa: BLE001
        logger.error("2FA-Code-Mail an %s fehlgeschlagen: %s", user.email, e)
        return False, str(e)


# ---------- Login-Verifikation ----------
def verify_second_factor(user: User, code: str) -> bool:
    """Prueft TOTP bzw. E-Mail-Code je nach Methode; Backup-Code als Fallback."""
    code = (code or "").strip()
    if not code:
        return False
    if user.twofa_method == "totp" and user.totp_secret_encrypted:
        if verify_totp(decrypt(user.totp_secret_encrypted), code):
            return True
    elif user.twofa_method == "email":
        if verify_email_code(user, code):
            clear_email_code(user)
            return True
    return consume_backup_code(user, code)


# ---------- Policy ----------
def twofa_required_for(user: User, policy: str) -> bool:
    if policy == "all":
        return True
    if policy == "admins":
        return user.role.value == "admin"
    return False
