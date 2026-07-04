"""Pydantic Schemas fuer Request/Response-Validierung."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import CampaignStatus, TrackingEventType, UserRole


# --- User ---

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


# --- Template ---

class TemplateBase(BaseModel):
    name: str
    subject: str
    html_content: str


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    html_content: str | None = None


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
    scheduled_at: datetime | None = None


class CampaignCreate(CampaignBase):
    recipients: list[RecipientCreate] = []


class CampaignUpdate(BaseModel):
    name: str | None = None
    template_id: uuid.UUID | None = None
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
