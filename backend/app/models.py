# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""SQLAlchemy ORM-Modelle.

MVP-Schema abgeleitet aus dem Scope in CLAUDE.MD (Campaign-CRUD,
Template-System, Tracking, Basis-Dashboard, CSV-Export, generischer
OIDC-Login). docs/phishing-awareness-database-schema.md existiert noch
nicht - dieses Schema ist ein bewusst schlanker MVP-Entwurf und kein
Abgleich mit einer verbindlichen Schema-Doku.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrackingEventType(str, enum.Enum):
    SENT = "sent"
    OPENED = "opened"
    CLICKED = "clicked"
    SUBMITTED = "submitted"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "password_hash IS NOT NULL OR oidc_subject IS NOT NULL",
            name="ck_users_has_login_method",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    oidc_subject: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=UserRole.USER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # --- Zwei-Faktor-Authentifizierung (2FA) ---
    # method: None (aus) | "totp" (Authenticator-App) | "email" (Einmalcode per Mail)
    twofa_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    totp_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    totp_pending_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    twofa_backup_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-Liste gehashter Codes
    twofa_email_code_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    twofa_email_code_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    templates: Mapped[list["Template"]] = relationship(back_populates="created_by")
    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="created_by")

    @property
    def twofa_enabled(self) -> bool:
        return self.twofa_method is not None


class AuditEvent(Base):
    """Audit-Log: Anmelde- und System-Aenderungsereignisse (admin-einsehbar).

    Actor-E-Mail/-Name werden als Snapshot gespeichert, damit ein geloeschter
    Nutzer das Log nicht unlesbar macht (FK ist ON DELETE SET NULL).
    """

    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_email: Mapped[str] = mapped_column(String(320), default="", nullable=False)
    actor_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="system", nullable=False)  # auth | system
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)


class SecurityConfig(Base):
    """Sicherheits-Policy (Singleton). Steuert die 2FA-Pflicht."""

    __tablename__ = "security_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # require_2fa: "off" (freiwillig) | "admins" (nur Admin-Konten) | "all" (alle)
    require_2fa: Mapped[str] = mapped_column(String(16), default="off", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LicenseState(Base):
    """Lizenzstatus (Singleton). Cached das zuletzt gueltige, signierte Lease.

    Der Lizenzschluessel liegt verschluesselt (Fernet); die Entitlements werden
    aus dem verifizierten Lease abgeleitet. Ohne Lizenz laeuft der Core als
    reiner Open-Core (keine Add-ons).
    """

    __tablename__ = "license_state"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False)
    license_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    lease_jwt: Mapped[str | None] = mapped_column(Text, nullable=True)
    features: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    customer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # Lease exp = Grace-Ende
    license_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str] = mapped_column(String(32), default="no_license", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(998), nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    # Optionaler Plain-Text-Teil (wird als text/plain-Alternative gesendet).
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Anhaenge als Liste von {filename, content_type, content_b64} (Base64).
    attachments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    # Optionale Markdown-Quelle, falls im Markdown-Modus erstellt (html_content wird daraus generiert).
    markdown_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by: Mapped["User"] = relationship(back_populates="templates")
    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="template")


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("templates.id"), nullable=False)
    # Optional: ohne Sending Profile faellt der Versand auf das globale .env-SMTP
    # zurueck; ohne Landing Page zeigt der Klick-Link auf keine eigene Seite.
    sending_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("sending_profiles.id"), nullable=True
    )
    landing_page_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("landing_pages.id"), nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="campaign_status", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=CampaignStatus.DRAFT,
        nullable=False,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    template: Mapped["Template"] = relationship(back_populates="campaigns")
    sending_profile: Mapped["SendingProfile | None"] = relationship()
    landing_page: Mapped["LandingPage | None"] = relationship()
    created_by: Mapped["User"] = relationship(back_populates="campaigns")
    recipients: Mapped[list["Recipient"]] = relationship(back_populates="campaign", cascade="all, delete-orphan")


class Recipient(Base):
    __tablename__ = "recipients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tracking_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign: Mapped["Campaign"] = relationship(back_populates="recipients")
    tracking_events: Mapped[list["TrackingEvent"]] = relationship(
        back_populates="recipient", cascade="all, delete-orphan"
    )


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recipients.id"), nullable=False)
    event_type: Mapped[TrackingEventType] = mapped_column(
        Enum(TrackingEventType, name="tracking_event_type", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    recipient: Mapped["Recipient"] = relationship(back_populates="tracking_events")


class SendingProfile(Base):
    """Wiederverwendbares SMTP-Versandprofil (GoPhish: 'Sending Profile').

    Das Passwort liegt verschluesselt (Fernet) in ``password_encrypted``, nie
    im Klartext - siehe app/utils/crypto.py.
    """

    __tablename__ = "sending_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(default=587, nullable=False)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_email: Mapped[str] = mapped_column(String(320), nullable=False)
    from_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # TLS-Modus: "none" (Port 25), "starttls" (Port 587), "ssl" (implizit, Port 465)
    tls_mode: Mapped[str] = mapped_column(String(16), default="starttls", nullable=False)
    ignore_cert_errors: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def has_password(self) -> bool:
        """Fuer die API-Ausgabe: ob ein Passwort hinterlegt ist (ohne es preiszugeben)."""
        return self.password_encrypted is not None


class LdapConfig(Base):
    """LDAP-Anbindung fuer den Empfaenger-Import.

    Singleton: es existiert genau eine Zeile (siehe app/api/settings.py).
    Das Bind-Passwort liegt verschluesselt (Fernet) in ``bind_password_encrypted``.
    """

    __tablename__ = "ldap_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    host: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    port: Mapped[int] = mapped_column(default=389, nullable=False)
    use_ssl: Mapped[bool] = mapped_column(default=False, nullable=False)
    start_tls: Mapped[bool] = mapped_column(default=False, nullable=False)
    bind_dn: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    bind_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_dn: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    user_filter: Mapped[str] = mapped_column(String(512), default="(objectClass=person)", nullable=False)
    attr_email: Mapped[str] = mapped_column(String(64), default="mail", nullable=False)
    attr_first_name: Mapped[str] = mapped_column(String(64), default="givenName", nullable=False)
    attr_last_name: Mapped[str] = mapped_column(String(64), default="sn", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def has_bind_password(self) -> bool:
        return self.bind_password_encrypted is not None


class SmtpConfig(Base):
    """Globales Fallback-SMTP, im Dashboard verwaltet.

    Singleton; wird beim ersten Zugriff aus den .env-Werten befuellt.
    Greift nur, wenn eine Kampagne kein eigenes Sending Profile nutzt.
    Das Passwort liegt verschluesselt (Fernet) in ``password_encrypted``.
    """

    __tablename__ = "smtp_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    port: Mapped[int] = mapped_column(default=587, nullable=False)
    username: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    from_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    tls_mode: Mapped[str] = mapped_column(String(16), default="starttls", nullable=False)
    verify_ssl: Mapped[bool] = mapped_column(default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def has_password(self) -> bool:
        return self.password_encrypted is not None


class OidcConfig(Base):
    """OIDC-Anbindung (optionale Zweitanmeldung), im Dashboard verwaltet.

    Singleton. Das Client-Secret liegt verschluesselt (Fernet).
    """

    __tablename__ = "oidc_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    issuer: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    client_id: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    client_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    redirect_uri: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def has_client_secret(self) -> bool:
        return self.client_secret_encrypted is not None


class Group(Base):
    """Wiederverwendbare Empfaengerliste (GoPhish: 'Group').

    Mitglieder koennen per CSV oder LDAP importiert werden. Beim Start einer
    Kampagne werden sie in campaign-eigene Recipients kopiert.
    """

    __tablename__ = "recipient_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members: Mapped[list["GroupMember"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )

    @property
    def member_count(self) -> int:
        return len(self.members)


class LandingPage(Base):
    """Landing Page (GoPhish: 'Page') - Ziel des Links aus der Phishing-Mail.

    Optionales Erfassen abgeschickter Formulardaten (capture_credentials) und
    Passwoerter (capture_passwords) sowie Weiterleitung nach dem Absenden.
    Das eigentliche Ausliefern/Capturen wird im Campaign-Schritt verdrahtet.
    """

    __tablename__ = "landing_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    markdown_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    capture_credentials: Mapped[bool] = mapped_column(default=False, nullable=False)
    capture_passwords: Mapped[bool] = mapped_column(default=False, nullable=False)
    redirect_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class GroupMember(Base):
    __tablename__ = "group_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recipient_groups.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group: Mapped["Group"] = relationship(back_populates="members")
