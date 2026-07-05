"""Settings-Dashboard-Endpunkte (admin-only).

Aktuell: LDAP-Anbindung fuer den Empfaenger-Import. Weitere Einstellungs-
Abschnitte koennen hier als zusaetzliche Unter-Router andocken.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin
from app.services.audit import client_ip, record_audit
from app.database import get_db
from app.models import LdapConfig, OidcConfig, SecurityConfig, User
from app.schemas import (
    LdapConfigOut,
    LdapConfigUpdate,
    LdapTestResult,
    OidcConfigOut,
    OidcConfigUpdate,
    SecurityConfigOut,
    SecurityConfigUpdate,
    SmtpConfigOut,
    SmtpConfigUpdate,
    SmtpTestResult,
)
from app.services.ldap import LdapParams, test_connection
from app.services.mail import test_smtp_params
from app.services.smtp_config import get_or_create_smtp_config
from app.utils.crypto import decrypt, encrypt

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create_ldap_config(db: Session) -> LdapConfig:
    """LDAP-Config ist ein Singleton: erste Zeile lesen oder Default anlegen."""
    config = db.query(LdapConfig).first()
    if config is None:
        config = LdapConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_or_create_oidc_config(db: Session) -> OidcConfig:
    config = db.query(OidcConfig).first()
    if config is None:
        config = OidcConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/ldap", response_model=LdapConfigOut)
def get_ldap(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return get_or_create_ldap_config(db)


@router.put("/ldap", response_model=LdapConfigOut)
def update_ldap(
    payload: LdapConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    config = get_or_create_ldap_config(db)
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("bind_password", None)
    for field, value in data.items():
        setattr(config, field, value)
    if password is not None:
        # Leerer String -> Passwort entfernen; sonst neu verschluesseln.
        config.bind_password_encrypted = encrypt(password) if password else None
    db.commit()
    db.refresh(config)
    record_audit(db, action="settings.ldap.updated", description="LDAP-Einstellungen geändert", actor=current, ip=client_ip(request))
    return config


@router.post("/ldap/test", response_model=LdapTestResult)
def test_ldap(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Testet die aktuell gespeicherte LDAP-Config (vorher speichern)."""
    config = get_or_create_ldap_config(db)
    password = decrypt(config.bind_password_encrypted) if config.bind_password_encrypted else None
    params = LdapParams(
        host=config.host,
        port=config.port,
        use_ssl=config.use_ssl,
        start_tls=config.start_tls,
        bind_dn=config.bind_dn,
        bind_password=password,
        base_dn=config.base_dn,
        user_filter=config.user_filter,
        attr_email=config.attr_email,
        attr_first_name=config.attr_first_name,
        attr_last_name=config.attr_last_name,
    )
    success, detail = test_connection(params)
    return LdapTestResult(success=success, detail=detail)


@router.get("/smtp", response_model=SmtpConfigOut)
def get_smtp(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return get_or_create_smtp_config(db)


@router.put("/smtp", response_model=SmtpConfigOut)
def update_smtp(
    payload: SmtpConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    config = get_or_create_smtp_config(db)
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for field, value in data.items():
        setattr(config, field, value)
    if password is not None:
        # Leerer String -> Passwort entfernen; sonst neu verschluesseln.
        config.password_encrypted = encrypt(password) if password else None
    db.commit()
    db.refresh(config)
    record_audit(db, action="settings.smtp.updated", description="SMTP-Einstellungen geändert", actor=current, ip=client_ip(request))
    return config


@router.post("/smtp/test", response_model=SmtpTestResult)
async def test_smtp(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Testet die aktuell gespeicherte SMTP-Config (vorher speichern)."""
    config = get_or_create_smtp_config(db)
    password = decrypt(config.password_encrypted) if config.password_encrypted else None
    success, detail = await test_smtp_params(
        host=config.host,
        port=config.port,
        tls_mode=config.tls_mode,
        validate_certs=config.verify_ssl,
        username=config.username or None,
        password=password,
    )
    return SmtpTestResult(success=success, detail=detail)


@router.get("/oidc", response_model=OidcConfigOut)
def get_oidc(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return get_or_create_oidc_config(db)


@router.put("/oidc", response_model=OidcConfigOut)
def update_oidc(
    payload: OidcConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    config = get_or_create_oidc_config(db)
    data = payload.model_dump(exclude_unset=True)
    secret = data.pop("client_secret", None)
    for field, value in data.items():
        setattr(config, field, value)
    if secret is not None:
        config.client_secret_encrypted = encrypt(secret) if secret else None
    db.commit()
    db.refresh(config)
    record_audit(db, action="settings.oidc.updated", description="OIDC-Einstellungen geändert", actor=current, ip=client_ip(request))
    return config


def get_or_create_security_config(db: Session) -> SecurityConfig:
    config = db.query(SecurityConfig).first()
    if config is None:
        config = SecurityConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/security", response_model=SecurityConfigOut)
def get_security(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return get_or_create_security_config(db)


@router.put("/security", response_model=SecurityConfigOut)
def update_security(
    payload: SecurityConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    if payload.require_2fa not in {"off", "admins", "all"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ungültiger Wert für require_2fa")
    config = get_or_create_security_config(db)
    config.require_2fa = payload.require_2fa
    db.commit()
    db.refresh(config)
    policy_label = {"off": "freiwillig", "admins": "für Admins verpflichtend", "all": "für alle verpflichtend"}
    record_audit(
        db,
        action="settings.security.updated",
        description=f"2FA-Pflicht: {policy_label.get(config.require_2fa, config.require_2fa)}",
        actor=current,
        ip=client_ip(request),
    )
    return config
