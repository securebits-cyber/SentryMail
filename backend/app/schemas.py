"""Pydantic Schemas fuer Request/Response-Validierung."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import CampaignStatus, TrackingEventType, UserRole


# --- Audit-Log ---

class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    actor_email: str
    actor_name: str
    category: str
    action: str
    description: str
    ip: str | None


class AuditEventList(BaseModel):
    total: int
    events: list[AuditEventOut]


# --- Login & 2FA ---

class LoginResult(BaseModel):
    twofa_required: bool = False
    setup_required: bool = False
    method: str | None = None  # "totp" | "email" (aktive Methode, wenn 2FA gefordert)
    pre_auth_token: str | None = None
    access_token: str | None = None
    token_type: str = "bearer"


class TwoFAStatus(BaseModel):
    method: str | None
    enabled: bool
    backup_codes_remaining: int
    required: bool  # ob die Policy 2FA fuer diesen Nutzer verlangt


class TotpSetupOut(BaseModel):
    secret: str
    provisioning_uri: str
    qr_data_uri: str


class TwoFACodeIn(BaseModel):
    code: str


class TwoFAActivated(BaseModel):
    backup_codes: list[str]
    access_token: str | None = None  # gesetzt, wenn Einrichtung im (erzwungenen) Login erfolgte


class TwoFADisableIn(BaseModel):
    password: str


class TwoFAEmailSetupResult(BaseModel):
    success: bool
    detail: str


class SecurityConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    require_2fa: str  # off | admins | all


class SecurityConfigUpdate(BaseModel):
    require_2fa: str


# --- User ---

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    twofa_enabled: bool
    created_at: datetime


# --- Template ---

class TemplateAttachment(BaseModel):
    filename: str
    content_type: str
    content_b64: str


class TemplateBase(BaseModel):
    name: str
    subject: str
    html_content: str
    text_content: str | None = None
    attachments: list[TemplateAttachment] = []


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    html_content: str | None = None
    text_content: str | None = None
    attachments: list[TemplateAttachment] | None = None


class TemplateOut(TemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Recipient ---

class RecipientCreate(BaseModel):
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None


class RecipientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    first_name: str | None
    last_name: str | None
    sent_at: datetime | None


# --- Campaign ---

class CampaignBase(BaseModel):
    name: str
    template_id: uuid.UUID
    sending_profile_id: uuid.UUID | None = None
    landing_page_id: uuid.UUID | None = None
    scheduled_at: datetime | None = None


class CampaignCreate(CampaignBase):
    # Empfaenger kommen aus den gewaehlten Gruppen und/oder direkt uebergeben.
    group_ids: list[uuid.UUID] = []
    recipients: list[RecipientCreate] = []


class CampaignUpdate(BaseModel):
    name: str | None = None
    template_id: uuid.UUID | None = None
    sending_profile_id: uuid.UUID | None = None
    landing_page_id: uuid.UUID | None = None
    status: CampaignStatus | None = None
    scheduled_at: datetime | None = None


class CampaignOut(CampaignBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: CampaignStatus
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Tracking / Results ---

class TrackingEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: TrackingEventType
    occurred_at: datetime


class CampaignResultOut(BaseModel):
    campaign_id: uuid.UUID
    total_recipients: int
    sent: int
    opened: int
    clicked: int
    submitted: int


# --- Sending Profile (SMTP) ---

class SendingProfileBase(BaseModel):
    name: str
    host: str
    port: int = 587
    username: str | None = None
    from_email: EmailStr
    from_name: str
    # "none" (Port 25), "starttls" (Port 587), "ssl" (Port 465)
    tls_mode: Literal["none", "starttls", "ssl"] = "starttls"
    ignore_cert_errors: bool = False


class SendingProfileCreate(SendingProfileBase):
    # Passwort ist write-only: wird verschluesselt gespeichert, nie zurueckgegeben.
    password: str | None = None


class SendingProfileUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None
    from_email: EmailStr | None = None
    from_name: str | None = None
    tls_mode: Literal["none", "starttls", "ssl"] | None = None
    ignore_cert_errors: bool | None = None


class SendingProfileOut(SendingProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    has_password: bool
    created_at: datetime
    updated_at: datetime


class SendingProfileTestRequest(BaseModel):
    email: EmailStr


class SendingProfileTestResult(BaseModel):
    success: bool
    detail: str


# --- LDAP-Konfiguration (Settings-Dashboard) ---

class LdapConfigUpdate(BaseModel):
    enabled: bool | None = None
    host: str | None = None
    port: int | None = None
    use_ssl: bool | None = None
    start_tls: bool | None = None
    bind_dn: str | None = None
    bind_password: str | None = None  # write-only, verschluesselt gespeichert
    base_dn: str | None = None
    user_filter: str | None = None
    attr_email: str | None = None
    attr_first_name: str | None = None
    attr_last_name: str | None = None


class LdapConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    host: str
    port: int
    use_ssl: bool
    start_tls: bool
    bind_dn: str
    has_bind_password: bool
    base_dn: str
    user_filter: str
    attr_email: str
    attr_first_name: str
    attr_last_name: str


class LdapTestResult(BaseModel):
    success: bool
    detail: str


# --- SMTP-Fallback (Settings-Dashboard) ---
# Globales Fallback-SMTP, greift wenn eine Kampagne kein Sending Profile hat.
# Beim ersten Zugriff aus der .env befuellt, danach in der DB verwaltet.

class SmtpConfigUpdate(BaseModel):
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None  # write-only, verschluesselt gespeichert
    from_email: str | None = None
    from_name: str | None = None
    tls_mode: str | None = None
    verify_ssl: bool | None = None


class SmtpConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    host: str
    port: int
    username: str
    has_password: bool
    from_email: str
    from_name: str
    tls_mode: str
    verify_ssl: bool


class SmtpTestResult(BaseModel):
    success: bool
    detail: str


# --- OIDC-Konfiguration (Settings-Dashboard) ---

class OidcConfigUpdate(BaseModel):
    enabled: bool | None = None
    issuer: str | None = None
    client_id: str | None = None
    client_secret: str | None = None  # write-only, verschluesselt gespeichert
    redirect_uri: str | None = None


class OidcConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    issuer: str
    client_id: str
    has_client_secret: bool
    redirect_uri: str


# --- Groups (Empfaengerlisten) ---

class GroupMemberIn(BaseModel):
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    position: str | None = None


class GroupMemberOut(GroupMemberIn):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class GroupCreate(BaseModel):
    name: str
    members: list[GroupMemberIn] = []


class GroupUpdate(BaseModel):
    name: str | None = None
    # Wenn gesetzt, ersetzt die Mitgliederliste vollstaendig.
    members: list[GroupMemberIn] | None = None


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    created_at: datetime
    updated_at: datetime
    members: list[GroupMemberOut] = []


class GroupSummary(BaseModel):
    """Kompakte Listenansicht ohne die Mitglieder-Details."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    member_count: int
    created_at: datetime
    updated_at: datetime


class LdapImportResult(BaseModel):
    success: bool
    detail: str
    found: int = 0
    added: int = 0


# --- Landing Pages ---

class LandingPageBase(BaseModel):
    name: str
    html_content: str
    capture_credentials: bool = False
    capture_passwords: bool = False
    redirect_url: str | None = None


class LandingPageCreate(LandingPageBase):
    pass


class LandingPageUpdate(BaseModel):
    name: str | None = None
    html_content: str | None = None
    capture_credentials: bool | None = None
    capture_passwords: bool | None = None
    redirect_url: str | None = None


class LandingPageOut(LandingPageBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Dashboard / Uebersicht ---

class DashboardSummary(BaseModel):
    campaigns: int
    recipients: int
    sent: int
    opened: int
    clicked: int
    submitted: int


class FailedRecipient(BaseModel):
    email: str
    first_name: str | None
    last_name: str | None
    campaign_id: uuid.UUID
    campaign_name: str
    status: str  # "submitted" (Daten abgeschickt) oder "clicked" (Link geklickt)
    occurred_at: datetime
