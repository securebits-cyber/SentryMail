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


class SMTPClient:
    """Async SMTP Client - funktioniert mit jedem Standard-SMTP-Anbieter."""

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        self.use_tls = settings.SMTP_USE_TLS
        self.verify_ssl = settings.SMTP_VERIFY_SSL
        self.timeout = settings.SMTP_TIMEOUT

    async def connect(self) -> SMTP:
        client = SMTP(
            hostname=self.host,
            port=self.port,
            timeout=self.timeout,
            use_tls=self.use_tls,
            validate_certs=self.verify_ssl,
        )
        await client.connect()
        if self.username and self.password:
            await client.login(self.username, self.password)
        logger.info("Connected to SMTP %s:%s", self.host, self.port)
        return client

    async def send_batch(
        self,
        campaign_id: str,
        recipients: list[dict],
        template_html: str,
        subject: str,
        tracking_pixel_base_url: str,
    ) -> dict[str, int]:
        """Sendet einen Batch von Emails mit Ratelimiting (SMTP_BATCH_DELAY)."""
        results = {"success": 0, "failed": 0}
        client = await self.connect()

        try:
            for i, recipient in enumerate(recipients):
                tracking_token = recipient["tracking_token"]
                tracking_pixel_url = f"{tracking_pixel_base_url}/pixel?t={tracking_token}"
                click_tracking_link = f"{tracking_pixel_base_url}/click?t={tracking_token}&url={{url}}"

                jinja_template = Template(template_html)
                html_body = jinja_template.render(
                    recipient_name=recipient.get("first_name", ""),
                    recipient_email=recipient.get("email", ""),
                    click_link=click_tracking_link,
                )

                msg = MIMEMultipart("alternative")
                msg["Subject"] = Header(subject, "utf-8")
                msg["From"] = f"{self.from_name} <{self.from_email}>"
                msg["To"] = recipient["email"]
                msg["X-Mailer"] = "PhishAware"

                text_body = f"Hallo {recipient.get('first_name', 'User')},\n\n[Bitte HTML-faehigen Mail-Client nutzen]"
                msg.attach(MIMEText(text_body, "plain", "utf-8"))

                html_with_pixel = f"{html_body}\n<img src='{tracking_pixel_url}' width='1' height='1' alt='' />"
                msg.attach(MIMEText(html_with_pixel, "html", "utf-8"))

                try:
                    await client.send_message(msg, mail_from=self.from_email)
                    results["success"] += 1
                except Exception as e:
                    results["failed"] += 1
                    logger.error("Zustellung an %s fehlgeschlagen: %s", recipient["email"], e)

                # Rate-Limiting - viele Anbieter begrenzen Versand pro Stunde.
                # SMTP_BATCH_DELAY in .env an den jeweiligen Anbieter anpassen.
                if (i + 1) % 5 == 0:
                    await asyncio.sleep(settings.SMTP_BATCH_DELAY)

        finally:
            await client.quit()

        logger.info("Batch fuer Campaign %s abgeschlossen: %s success, %s failed", campaign_id, results["success"], results["failed"])
        return results


smtp_client = SMTPClient()


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
