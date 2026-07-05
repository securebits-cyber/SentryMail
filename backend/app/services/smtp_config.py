# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zugriff auf das globale Fallback-SMTP (Singleton in der DB).

Greift nur, wenn eine Kampagne kein eigenes Sending Profile nutzt.
Beim ersten Zugriff wird die Zeile aus den .env-Werten vorbefuellt; danach
ist die DB die einzige Quelle (Verwaltung im Settings-Dashboard).
"""
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import SmtpConfig
from app.utils.crypto import encrypt


def get_or_create_smtp_config(db: Session) -> SmtpConfig:
    config = db.query(SmtpConfig).first()
    if config is None:
        env = get_settings()
        config = SmtpConfig(
            host=env.SMTP_HOST,
            port=env.SMTP_PORT,
            username=env.SMTP_USERNAME,
            password_encrypted=encrypt(env.SMTP_PASSWORD) if env.SMTP_PASSWORD else None,
            from_email=env.SMTP_FROM_EMAIL,
            from_name=env.SMTP_FROM_NAME,
            tls_mode=env.SMTP_TLS_MODE,
            verify_ssl=env.SMTP_VERIFY_SSL,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config
