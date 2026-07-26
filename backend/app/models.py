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
from datetime import datetime, time

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String, Text, Time, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    #: Datenschutzbeauftragter/Personalrat (Welle 2, Rollentrennung). Kontroll-,
    #: keine Auswerterrolle: gibt Einzelpersonen-Auswertungen im Vier-Augen-
    #: Verfahren frei und liest das Audit-Log, konfiguriert aber die Instanz nicht.
    PRIVACY_OFFICER = "privacy_officer"
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
    # Hauptadmin (Bootstrap-/Erstadmin): kann nicht gelöscht werden.
    is_primary: Mapped[bool] = mapped_column(default=False, nullable=False, server_default="false")

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
    # Seit dem Preflight (Welle 9.2) gibt es zwei Fremdschluessel von campaigns
    # nach users (Ersteller und Bestaetiger) - der Pfad muss benannt werden.
    campaigns: Mapped[list["Campaign"]] = relationship(
        back_populates="created_by", foreign_keys="Campaign.created_by_id"
    )

    @property
    def twofa_enabled(self) -> bool:
        return self.twofa_method is not None


class AuditEvent(Base):
    """Audit-Log: Anmelde- und System-Aenderungsereignisse (admin-einsehbar).

    Actor-E-Mail/-Name werden als Snapshot gespeichert, damit ein geloeschter
    Nutzer das Log nicht unlesbar macht (FK ist ON DELETE SET NULL).

    **Hash-Verkettung (Welle 9.3).** Jeder Eintrag traegt den Hash seines
    Vorgaengers. Wer einen Eintrag nachtraeglich aendert oder entfernt, bricht
    die Kette ab dieser Stelle sichtbar - genau das macht "revisionssicher"
    ueberpruefbar statt behauptet.

    ``actor_id`` ist bewusst **nicht** Teil des Hashes: Der Fremdschluessel ist
    ON DELETE SET NULL, ein geloeschtes Konto wuerde die Kette rueckwirkend
    zerreissen. Gehasht werden die Schnappschuesse, die genau dafuer existieren.
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

    #: Lueckenlos aufsteigende Position in der Kette. Eine Luecke ist ein
    #: entfernter Eintrag - der Verifier meldet sie.
    seq: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    #: Hash des Vorgaengers; beim ersten Eintrag der Genesis-Wert.
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    entry_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    #: Gesetzt, wenn der Inhalt wegen einer Aufbewahrungsfrist geloescht wurde
    #: (Welle 2 hat Vorrang vor der Kette). Der Eintrag bleibt als Tombstone
    #: stehen: Hash und Verkettung ueberdauern, der Inhalt nicht. Der Verifier
    #: rechnet den Inhalts-Hash solcher Eintraege nicht nach - er kann nicht
    #: mehr stimmen und soll es auch nicht.
    content_purged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class SecurityConfig(Base):
    """Sicherheits-Policy (Singleton). Steuert die 2FA-Pflicht."""

    __tablename__ = "security_config"
    # Hoechstens eine Zeile (Singleton) - siehe app/utils/singleton.py.
    __table_args__ = (Index("uq_security_config_singleton", text("(true)"), unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # require_2fa: "off" (freiwillig) | "admins" (nur Admin-Konten) | "all" (alle)
    require_2fa: Mapped[str] = mapped_column(String(16), default="off", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PrivacyConfig(Base):
    """Datenschutz-/Mitbestimmungs-Policy (Singleton).

    Sammelt die Betreiber-Entscheidungen aus dem Datenschutz-Modus (Welle 2).

    ``fingerprinting_enabled`` steuert das Client-Fingerprinting: bewusst
    per Default AUS - Canvas-Fingerprinting ist im mitbestimmten Betrieb und
    unter Paragraf 25 TDDDG heikel und darf nur nach ausdruecklicher
    Admin-Bestaetigung erfasst werden. Der Fingerprint ist auch bei aktivem
    Flag nie Teil von Einzelpersonen-Reports.

    ``privacy_mode_enabled`` schaltet den Datenschutz-/Mitbestimmungs-Modus:
    Einzelpersonen-Auswertungen sind dann technisch gesperrt (Aufhebung nur per
    Vier-Augen-Freigabe) und Gruppenauswertungen werden erst ab
    ``k_anonymity_threshold`` Personen ausgegeben. Ebenfalls Default AUS -
    bestehende Instanzen aendern ihr Verhalten also nicht durch ein Update,
    der Betreiber schaltet den Modus bewusst ein.
    """

    __tablename__ = "privacy_config"
    # Hoechstens eine Zeile (Singleton) - siehe app/utils/singleton.py.
    __table_args__ = (
        Index("uq_privacy_config_singleton", text("(true)"), unique=True),
        # k = 1 waere keine Anonymisierung, sondern eine Einzelpersonen-Auswertung.
        CheckConstraint("k_anonymity_threshold >= 2", name="ck_privacy_config_k_min"),
        CheckConstraint(
            "retention_days IS NULL OR retention_days >= 1", name="ck_privacy_config_retention_min"
        ),
        CheckConstraint(
            "audit_retention_days IS NULL OR audit_retention_days >= 1",
            name="ck_privacy_config_audit_retention_min",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fingerprinting_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    privacy_mode_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    k_anonymity_threshold: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    #: Aufbewahrungsdauer in Tagen. ``None`` = keine automatische Loeschung -
    #: bewusst der Auslieferungszustand: ungefragt Daten zu loeschen waere
    #: schlimmer als sie aufzubewahren. Der Betreiber setzt den Wert.
    retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retention_last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Eigene Frist fuer die Inhalte des Audit-Logs (Welle 9.3). Bewusst
    #: getrennt von ``retention_days``: Das Audit-Log ist der Nachweis, den ein
    #: Kunde im Pruefungsfall braucht - es zusammen mit den Kampagnendaten
    #: stillschweigend mitzuloeschen waere eine boese Ueberraschung.
    #: ``None`` = die Inhalte bleiben. Ist eine Frist gesetzt, gilt die
    #: Konfliktregel: Der Inhalt geht, Hash und Verkettung bleiben (Tombstone).
    audit_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PrivacyUnlockStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"
    # "abgelaufen" ist bewusst kein gespeicherter Zustand: er ergibt sich aus
    # ``expires_at`` und braucht keinen Hintergrundjob, der ihn nachtraegt.


class PrivacyUnlockRequest(Base):
    """Antrag auf befristete Aufhebung der Einzelpersonen-Sperre (Welle 2).

    Vier-Augen-Prinzip: Ein Admin beantragt mit Begruendung, entschieden wird
    ausschliesslich vom Datenschutzbeauftragten. Dass Antragsteller und
    Entscheider verschieden sind, sichert zusaetzlich ein CheckConstraint - die
    Regel darf nicht allein an der Anwendungslogik haengen.

    Freigaben gelten immer nur befristet, nur fuer den Antragsteller und
    wahlweise nur fuer eine Kampagne (``campaign_id``); ohne Kampagne ist die
    Freigabe global. Beides zusammen haelt die Aufhebung so eng wie moeglich.
    """

    __tablename__ = "privacy_unlock_requests"
    __table_args__ = (
        CheckConstraint(
            "decided_by_id IS NULL OR decided_by_id <> requested_by_id",
            name="ck_privacy_unlock_four_eyes",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Snapshot wie im Audit-Log: ein geloeschtes Konto darf die Historie des
    # Freigabeverfahrens nicht unlesbar machen.
    requested_by_email: Mapped[str] = mapped_column(String(320), default="", nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    duration_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    status: Mapped[PrivacyUnlockStatus] = mapped_column(
        Enum(
            PrivacyUnlockStatus,
            name="privacy_unlock_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=PrivacyUnlockStatus.PENDING,
        nullable=False,
    )
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decided_by_email: Mapped[str] = mapped_column(String(320), default="", nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )


class LicenseState(Base):
    """Lizenzstatus (Singleton). Cached das zuletzt gueltige, signierte Lease.

    Der Lizenzschluessel liegt verschluesselt (Fernet); die Entitlements werden
    aus dem verifizierten Lease abgeleitet. Ohne Lizenz laeuft der Core als
    reiner Open-Core (keine Add-ons).
    """

    __tablename__ = "license_state"
    # Hoechstens eine Zeile (Singleton) - siehe app/utils/singleton.py.
    __table_args__ = (Index("uq_license_state_singleton", text("(true)"), unique=True),)

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
    __table_args__ = (
        CheckConstraint("risk_class IN ('low', 'medium', 'high')", name="ck_templates_risk_class"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(998), nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    # Optionaler Plain-Text-Teil (wird als text/plain-Alternative gesendet).
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Anhaenge als Liste von {filename, content_type, content_b64} (Base64).
    attachments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    # Optionales Logo (data:image/...;base64,...), im HTML über {{ logo }} platzierbar.
    # Beim Versand als Inline-Bild (CID) eingebettet, damit es zuverlässig rendert.
    logo_b64: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optionale Markdown-Quelle, falls im Markdown-Modus erstellt (html_content wird daraus generiert).
    markdown_source: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Risikoklasse des Koeder-Themas (Welle 9.2). Ein Gehalts- oder
    #: Kuendigungsvorwand trifft Menschen anders als eine Paketbenachrichtigung;
    #: ``high`` erzwingt deshalb vor dem Start eine Zweitfreigabe. Gepflegt wird
    #: sie am Template, weil das Thema am Template haengt und nicht an der
    #: einzelnen Kampagne. Default ``low`` - ein Update aendert das Verhalten
    #: bestehender Vorlagen also nicht.
    risk_class: Mapped[str] = mapped_column(String(16), default="low", nullable=False)
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
    #: Bestaetigter Preflight (Welle 9.2). Ohne Bestaetigung startet die
    #: Kampagne nicht - wer versendet, soll vorher gesehen haben, wen er trifft.
    #: Jede inhaltliche Aenderung setzt die Bestaetigung zurueck, sonst gaebe sie
    #: einen Stand frei, den niemand geprueft hat.
    preflight_ack_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    preflight_ack_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    template: Mapped["Template"] = relationship(back_populates="campaigns")
    sending_profile: Mapped["SendingProfile | None"] = relationship()
    landing_page: Mapped["LandingPage | None"] = relationship()
    created_by: Mapped["User"] = relationship(
        back_populates="campaigns", foreign_keys=[created_by_id]
    )
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
    # Denormalisierter Schnappschuss aus dem GroupMember zum Zeitpunkt des Kampagnen-
    # aufbaus - erlaubt Abteilungsvergleich und Kritikalitaet je Kampagne.
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criticality: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: Mitglied eines Leitungsorgans (Geschaeftsfuehrung, Vorstand). Grundlage
    #: des gesonderten Nachweises der Schulungspflicht nach Paragraf 38 BSIG.
    is_management: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    #: Zustellergebnis des letzten Versandversuchs (Welle 9.1). ``None`` = noch
    #: nicht versucht. Ohne diese Spalten bliebe vom Fehlschlag nur eine Zahl
    #: uebrig, und die beantwortet die Frage "warum kam die Mail nicht an" nicht.
    delivery_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: SMTP-Statuscode: 4xx voruebergehend (Greylisting, Rate Control),
    #: 5xx dauerhaft. Ein Verbindungsfehler hat keinen Code.
    delivery_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    delivery_error: Mapped[str | None] = mapped_column(String(512), nullable=True)
    delivery_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Zeitpunkt der Anonymisierung durch die Retention (Welle 2). Gesetzt heisst:
    #: E-Mail und Name sind unwiederbringlich ersetzt. Dient zugleich als Marker,
    #: damit ein erneuter Lauf dieselben Zeilen nicht noch einmal anfasst.
    anonymized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

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
    # Aus dem User-Agent abgeleitete Buckets (siehe app/utils/useragent.py).
    browser: Mapped[str | None] = mapped_column(String(64), nullable=True)
    os: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Laendercode (ISO 3166-1 alpha-2) via optionaler GeoIP-MMDB (app/utils/geoip.py).
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    # Aus Request-Headern / Query-Parametern erfasst.
    referrer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    accept_language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    utm_source: Mapped[str | None] = mapped_column(String(128), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(128), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Clientseitig per Landing-Page-Beacon nachgetragen (JavaScript).
    screen_resolution: Mapped[str | None] = mapped_column(String(16), nullable=True)
    client_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Leichtgewichtiger Client-Fingerprint (Hash aus stabilen Browser-Merkmalen).
    fingerprint: Mapped[str | None] = mapped_column(String(32), nullable=True)

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


class SmtpConfig(Base):
    """Globales Fallback-SMTP, im Dashboard verwaltet.

    Singleton; wird beim ersten Zugriff aus den .env-Werten befuellt.
    Greift nur, wenn eine Kampagne kein eigenes Sending Profile nutzt.
    Das Passwort liegt verschluesselt (Fernet) in ``password_encrypted``.
    """

    __tablename__ = "smtp_config"
    # Hoechstens eine Zeile (Singleton) - siehe app/utils/singleton.py.
    __table_args__ = (Index("uq_smtp_config_singleton", text("(true)"), unique=True),)

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
    # Hoechstens eine Zeile (Singleton) - siehe app/utils/singleton.py.
    __table_args__ = (Index("uq_oidc_config_singleton", text("(true)"), unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    issuer: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    client_id: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    client_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    redirect_uri: Mapped[str] = mapped_column(String(1024), default="", nullable=False)
    # E-Mails dieses IdP als verifiziert behandeln (bewusste Betreiber-Entscheidung
    # fuer IdPs, die email_verified nicht oder als false senden).
    trust_email: Mapped[bool] = mapped_column(default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def has_client_secret(self) -> bool:
        return self.client_secret_encrypted is not None


class Group(Base):
    """Wiederverwendbare Empfaengerliste (GoPhish: 'Group').

    Mitglieder koennen per CSV importiert werden (LDAP via Business-Add-on). Beim Start einer
    Kampagne werden sie in campaign-eigene Recipients kopiert.
    """

    __tablename__ = "recipient_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    #: Wer die Gruppe pflegt. ``manual`` = im Dashboard verwaltet (Default, auch
    #: fuer per LDAP/Entra befuellte Gruppen: das sind einmalige Importe, keine
    #: dauerhaften Eigentuemer). ``scim`` = vom Identity Provider verwaltet und
    #: deshalb im Dashboard schreibgeschuetzt - zwei Quellen, die dieselbe Gruppe
    #: schreiben, ueberschreiben sich sonst gegenseitig.
    source: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    #: Externe Kennung des IdP (SCIM ``externalId``), nur bei source="scim".
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
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
    # Optionales Logo (data:image/...;base64,...), im HTML über {{ logo }} platzierbar.
    logo_b64: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Funktion im Unternehmen
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Kritikalitaet der Person fuers Human Risk Management: "low" | "normal" | "high".
    criticality: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: Mitglied eines Leitungsorgans - siehe Recipient.is_management.
    is_management: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    group: Mapped["Group"] = relationship(back_populates="members")


class DeliveryConfig(Base):
    """Kanarienpostfach fuer den Zustell-Selbsttest (Welle 9.1, Singleton).

    Vor dem Kampagnenstart geht eine Probemail ueber denselben Weg wie die
    Kampagne an ein eigenes Postfach. Kommt sie dort an, ist der Weg frei;
    kommt sie nicht an, ist es das Gateway und nicht die Software - genau die
    Frage, die sonst zwei Wochen Support kostet.

    Ohne ``canary_address`` entfaellt der Test kommentarlos: Er ist eine Hilfe,
    keine Voraussetzung, und darf niemanden am Arbeiten hindern.

    Die IMAP-Zugangsdaten sind laufzeitverwaltete Credentials und liegen daher
    verschluesselt in der DB (Fernet, abgeleitet aus SECRET_KEY), nie im
    Klartext und nie in einer API-Antwort.
    """

    __tablename__ = "delivery_config"
    __table_args__ = (Index("uq_delivery_config_singleton", text("(true)"), unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canary_address: Mapped[str] = mapped_column(String(320), default="", nullable=False)
    #: Ohne IMAP wird die Probemail zwar versendet, aber nicht bestaetigt - der
    #: Test bleibt dann bei "gesendet, Ankunft unbestaetigt" stehen. Bewusst
    #: erlaubt: Der Versandfehler ist schon die haelfte der Diagnose.
    imap_host: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    imap_port: Mapped[int] = mapped_column(Integer, default=993, nullable=False)
    imap_username: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    imap_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    imap_use_ssl: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    imap_mailbox: Mapped[str] = mapped_column(String(255), default="INBOX", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DeliverySelfTest(Base):
    """Ergebnis eines Zustell-Selbsttests (Welle 9.1).

    ``status``: ``pending`` = versendet, Ankunft noch nicht bestaetigt;
    ``passed`` = im Kanarienpostfach gefunden; ``failed`` = Versand gescheitert
    oder Suchfrist abgelaufen.

    Ein Fehlschlag blockiert den Kampagnenstart **nicht**. Er warnt - die
    Entscheidung, trotzdem zu starten, bleibt beim Betreiber, der sein Gateway
    besser kennt als wir.
    """

    __tablename__ = "delivery_self_tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), index=True, nullable=False
    )
    #: Eindeutiger Marker im Betreff. Ueber ihn wird die Mail im Postfach
    #: wiedergefunden, ohne fremde Nachrichten anzufassen.
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    #: Schnappschuss des genutzten Absenderwegs - das Sending Profile kann
    #: spaeter umbenannt oder geloescht werden, der Befund bleibt lesbar.
    route: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    error: Mapped[str | None] = mapped_column(String(512), nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign: Mapped["Campaign"] = relationship()


class PreflightConfig(Base):
    """Regeln fuer den Blast-Radius-Preflight (Welle 9.2, Singleton).

    Der Pflichtdialog vor dem Kampagnenstart prueft gegen diese Werte. Alle
    Vorgaben sind so gewaehlt, dass ein Update das Verhalten bestehender
    Installationen nicht aendert: Quiet Hours aus, Cooldown 30 Tage wie in der
    Roadmap, Zweitfreigabe beim Admin.
    """

    __tablename__ = "preflight_config"
    __table_args__ = (
        Index("uq_preflight_config_singleton", text("(true)"), unique=True),
        CheckConstraint("cooldown_days >= 0", name="ck_preflight_cooldown_min"),
        CheckConstraint(
            "second_approval_role IN ('admin', 'privacy_officer')",
            name="ck_preflight_approval_role",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    #: Beide NULL = keine Ruhezeiten. Ein Fenster ueber Mitternacht (22:00-06:00)
    #: ist erlaubt und wird beim Pruefen als solches behandelt.
    quiet_hours_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    quiet_hours_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    #: IANA-Zeitzone fuer Ruhezeiten und Sperrfenster. Default UTC statt einer
    #: konkreten Region - der Betreiber setzt seine eigene, wir verdrahten keine.
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    #: Mindestabstand zwischen zwei Simulationen fuer dieselbe Person. 0 = aus.
    cooldown_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    #: Wer die Zweitfreigabe bei hoher Risikoklasse erteilt. Auf
    #: ``privacy_officer`` gestellt liegt sie bei der Betriebsratsrolle - genau
    #: die Verzahnung mit dem Mitbestimmungs-Modus aus Welle 2.
    second_approval_role: Mapped[str] = mapped_column(String(32), default="admin", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BlackoutWindow(Base):
    """Organisationsweites Sperrfenster (Welle 9.2).

    Zeitraum, in dem keine Simulation starten soll - Betriebsversammlung,
    Jahresabschluss, Systemumstellung. Anders als die Ruhezeiten ist das ein
    einmaliger Zeitraum mit Anlass.
    """

    __tablename__ = "blackout_windows"
    __table_args__ = (CheckConstraint("ends_at > starts_at", name="ck_blackout_order"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CampaignGroupExclusion(Base):
    """Von einer Kampagne ausgenommene Gruppe (Welle 9.2).

    **Hier steht bewusst kein Grund.** Ausgeschlossen wird ausschliesslich ueber
    die Gruppenzugehoerigkeit; warum jemand in dieser Gruppe ist, geht das
    System nichts an. Eine Spalte ``reason`` waere schnell ergaenzt und wuerde
    genauso schnell mit Elternzeit, Krankheit oder einem laufenden Verfahren
    gefuellt - besonders schutzwuerdige Daten, fuer die es keinen Zweck gibt.
    Wer sie braucht, fuehrt sie ausserhalb dieses Systems.
    """

    __tablename__ = "campaign_group_exclusions"
    __table_args__ = (
        Index("uq_campaign_group_exclusion", "campaign_id", "group_id", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), index=True, nullable=False
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recipient_groups.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CampaignApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CampaignApproval(Base):
    """Zweitfreigabe fuer eine Kampagne hoher Risikoklasse (Welle 9.2).

    Vier-Augen-Prinzip wie bei der Datenschutz-Freigabe aus Welle 2: Wer
    beantragt, entscheidet nicht. Gesichert an drei Stellen - durch die
    Rollenpruefung, durch eine explizite Pruefung im Endpunkt und durch einen
    CheckConstraint. Die Regel darf nicht allein an der Anwendungslogik haengen.

    Wer entscheiden darf, steht in ``PreflightConfig.second_approval_role``:
    ``admin`` oder ``privacy_officer``. Auf die Betriebsratsrolle gelegt ist das
    die vorgesehene Verzahnung mit dem Mitbestimmungs-Modus.
    """

    __tablename__ = "campaign_approvals"
    __table_args__ = (
        CheckConstraint(
            "decided_by_id IS NULL OR decided_by_id <> requested_by_id",
            name="ck_campaign_approval_four_eyes",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), index=True, nullable=False
    )
    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: Snapshot wie im Audit-Log: ein geloeschtes Konto darf die Historie des
    #: Freigabeverfahrens nicht unlesbar machen.
    requested_by_email: Mapped[str] = mapped_column(String(320), default="", nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[CampaignApprovalStatus] = mapped_column(
        Enum(
            CampaignApprovalStatus,
            name="campaign_approval_status",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        default=CampaignApprovalStatus.PENDING,
        nullable=False,
    )
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decided_by_email: Mapped[str] = mapped_column(String(320), default="", nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
