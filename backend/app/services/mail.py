"""SMTP Mail Service fuer HumanShield.APP.

Provider-agnostisch: kennt keinen bestimmten SMTP-Anbieter; alle Verbindungs-
werte kommen als Parameter (Sending Profile oder globales Fallback-SMTP aus
der DB). Siehe docs/phishing-awareness-smtp-konfiguration.md.
"""
import asyncio
import base64
import logging
from datetime import datetime
from email import encoders
from email.header import Header
from email.mime.base import MIMEBase
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


async def send_simple_email(
    *,
    host: str,
    port: int,
    tls_mode: str,
    validate_certs: bool,
    username: str | None,
    password: str | None,
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    text_body: str,
) -> None:
    """Sendet eine einfache Text-Mail (z. B. 2FA-Code) ueber explizite SMTP-Parameter."""
    client = await _open_smtp(
        host=host,
        port=port,
        tls_mode=tls_mode,
        validate_certs=validate_certs,
        username=username,
        password=password,
    )
    msg = MIMEText(text_body, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    try:
        await client.send_message(msg, sender=from_email)
    finally:
        await client.quit()


async def test_smtp_params(
    *,
    host: str,
    port: int,
    tls_mode: str,
    validate_certs: bool,
    username: str | None,
    password: str | None,
) -> tuple[bool, str]:
    """Testet Verbindung und Login mit explizit uebergebenen SMTP-Parametern."""
    try:
        client = await _open_smtp(
            host=host,
            port=port,
            tls_mode=tls_mode,
            validate_certs=validate_certs,
            username=username,
            password=password,
        )
        await client.quit()
        logger.info("SMTP-Test erfolgreich (%s:%s)", host, port)
        return True, f"Verbindung zu {host}:{port} erfolgreich."
    except Exception as e:
        logger.error("SMTP-Test fehlgeschlagen (%s:%s): %s", host, port, e)
        return False, f"Verbindung zu {host}:{port} fehlgeschlagen: {e}"


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
    template_text: str | None,
    recipients: list[dict],
    landing_url_base: str,
    pixel_url_base: str,
    attachments: list[dict] | None = None,
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

            # Personalisierungs-Variablen (plus Legacy-Aliase).
            ctx = {
                "first_name": recipient.get("first_name") or "",
                "last_name": recipient.get("last_name") or "",
                "email": recipient.get("email") or "",
                "link": click_link,
                "recipient_name": recipient.get("first_name") or "",
                "recipient_email": recipient.get("email") or "",
                "click_link": click_link,
            }
            html_body = Template(template_html).render(**ctx)
            text_body = (
                Template(template_text).render(**ctx)
                if template_text
                else f"Hallo {ctx['first_name']},"
            )

            html_with_pixel = f"{html_body}\n<img src='{pixel_url}' width='1' height='1' alt='' />"
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(text_body, "plain", "utf-8"))
            alt.attach(MIMEText(html_with_pixel, "html", "utf-8"))

            if attachments:
                # Anhaenge -> multipart/mixed mit der Alternative als erstem Teil.
                msg = MIMEMultipart("mixed")
                msg.attach(alt)
                for att in attachments:
                    maintype, _, subtype = (att.get("content_type") or "application/octet-stream").partition("/")
                    part = MIMEBase(maintype or "application", subtype or "octet-stream")
                    try:
                        part.set_payload(base64.b64decode(att["content_b64"]))
                    except Exception:  # noqa: BLE001
                        continue
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", "attachment", filename=att.get("filename") or "anhang")
                    msg.attach(part)
            else:
                msg = alt

            msg["Subject"] = Header(Template(subject).render(**ctx), "utf-8")
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = recipient["email"]
            msg["X-Mailer"] = "HumanShield.APP"

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
        msg["Subject"] = Header("HumanShield.APP Test-Mail", "utf-8")
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg["X-Mailer"] = "HumanShield.APP"
        msg.attach(
            MIMEText(
                "Dies ist eine Test-Mail von HumanShield.APP. Das Sending Profile funktioniert.",
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
