"""SMTP Mail Service fuer PhishAware.

Provider-agnostisch: kennt keinen bestimmten SMTP-Anbieter, nur die Werte
aus Settings (.env). Siehe docs/phishing-awareness-smtp-konfiguration.md.
"""
import asyncio
import logging
from datetime import datetime
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from aiosmtplib import SMTP
from jinja2 import Template

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def _open_smtp(
    *,
    host: str,
    port: int,
    tls_mode: str,
    validate_certs: bool,
    username: str | None = None,
    password: str | None = None,
    timeout: int | None = None,
) -> SMTP:
    """Oeffnet eine SMTP-Verbindung mit korrektem TLS-Handling.

    tls_mode: "ssl" = implizites TLS (Port 465), "starttls" = STARTTLS (Port 587),
    "none" = unverschluesselt (Port 25). Das falsche Verfahren auf dem falschen
    Port fuehrt sonst zu Fehlern wie WRONG_VERSION_NUMBER.
    """
    client = SMTP(
        hostname=host,
        port=port,
        timeout=timeout or settings.SMTP_TIMEOUT,
        use_tls=(tls_mode == "ssl"),
        start_tls=(tls_mode == "starttls"),
        validate_certs=validate_certs,
    )
    await client.connect()
    if username and password:
        await client.login(username, password)
    return client


class SMTPClient:
    """Async SMTP Client - funktioniert mit jedem Standard-SMTP-Anbieter."""

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        self.tls_mode = settings.SMTP_TLS_MODE
        self.verify_ssl = settings.SMTP_VERIFY_SSL
        self.timeout = settings.SMTP_TIMEOUT

    async def connect(self) -> SMTP:
        client = await _open_smtp(
            host=self.host,
            port=self.port,
            tls_mode=self.tls_mode,
            validate_certs=self.verify_ssl,
            username=self.username,
            password=self.password,
            timeout=self.timeout,
        )
        logger.info("Connected to SMTP %s:%s", self.host, self.port)
        return client

smtp_client = SMTPClient()


async def send_campaign_messages(
    *,
    host: str,
    port: int,
    tls_mode: str,
    validate_certs: bool,
    username: str | None,
    password: str | None,
    from_email: str,
    from_name: str,
    subject: str,
    template_html: str,
    recipients: list[dict],
    landing_url_base: str,
    pixel_url_base: str,
) -> dict[str, int]:
    """Versendet eine Kampagne ueber ein explizites SMTP-Profil.

    Pro Empfaenger wird ``{{ click_link }}`` auf die Landing-Page-URL (mit
    Tracking-Token) gerendert und ein Tracking-Pixel eingebettet. Ratelimiting
    ueber SMTP_BATCH_DELAY.
    """
    results = {"success": 0, "failed": 0}
    client = await _open_smtp(
        host=host, port=port, tls_mode=tls_mode, validate_certs=validate_certs,
        username=username, password=password,
    )
    try:
        for i, recipient in enumerate(recipients):
            token = recipient["tracking_token"]
            click_link = f"{landing_url_base}?t={token}"
            pixel_url = f"{pixel_url_base}/pixel?t={token}"

            html_body = Template(template_html).render(
                recipient_name=recipient.get("first_name", ""),
                recipient_email=recipient.get("email", ""),
                click_link=click_link,
            )

            msg = MIMEMultipart("alternative")
            msg["Subject"] = Header(subject, "utf-8")
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = recipient["email"]
            msg["X-Mailer"] = "PhishAware"
            msg.attach(MIMEText(f"Hallo {recipient.get('first_name', '')},", "plain", "utf-8"))
            html_with_pixel = f"{html_body}\n<img src='{pixel_url}' width='1' height='1' alt='' />"
            msg.attach(MIMEText(html_with_pixel, "html", "utf-8"))

            try:
                await client.send_message(msg, sender=from_email)
                results["success"] += 1
            except Exception as e:  # noqa: BLE001
                results["failed"] += 1
                logger.error("Zustellung an %s fehlgeschlagen: %s", recipient["email"], e)

            if (i + 1) % 5 == 0:
                await asyncio.sleep(settings.SMTP_BATCH_DELAY)
    finally:
        await client.quit()

    logger.info("Kampagnen-Batch: %s ok, %s fehlgeschlagen", results["success"], results["failed"])
    return results


async def test_smtp_connection() -> bool:
    """Testet die SMTP-Verbindung mit den aktuell konfigurierten .env-Werten."""
    try:
        client = await smtp_client.connect()
        await client.quit()
        logger.info("SMTP-Verbindung erfolgreich")
        return True
    except Exception as e:
        logger.error("SMTP-Verbindung fehlgeschlagen: %s", e)
        return False


async def send_test_email(
    *,
    host: str,
    port: int,
    username: str | None,
    password: str | None,
    from_email: str,
    from_name: str,
    tls_mode: str,
    validate_certs: bool,
    to_email: str,
) -> tuple[bool, str]:
    """Sendet eine Test-Mail ueber ein explizit uebergebenes SMTP-Profil.

    Wird vom Sending-Profile-Test-Endpoint genutzt und ist unabhaengig von der
    globalen .env-Konfiguration. Gibt (Erfolg, Detailmeldung) zurueck.
    """
    try:
        client = await _open_smtp(
            host=host,
            port=port,
            tls_mode=tls_mode,
            validate_certs=validate_certs,
            username=username,
            password=password,
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header("PhishAware Test-Mail", "utf-8")
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg["X-Mailer"] = "PhishAware"
        msg.attach(
            MIMEText(
                "Dies ist eine Test-Mail von PhishAware. Das Sending Profile funktioniert.",
                "plain",
                "utf-8",
            )
        )
        await client.send_message(msg, sender=from_email)
        await client.quit()
        logger.info("Test-Mail ueber %s:%s an %s gesendet", host, port, to_email)
        return True, f"Test-Mail an {to_email} gesendet."
    except Exception as e:
        logger.error("Test-Mail ueber %s:%s fehlgeschlagen: %s", host, port, e)
        return False, f"Fehler: {e}"
