# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Anwendungs-Konfiguration.

Alle umgebungsspezifischen Werte kommen ausschliesslich aus .env.
Keine Defaults fuer Secrets/Provider-Zugangsdaten - die App startet
bewusst nicht ohne gesetzte .env-Werte (siehe CLAUDE.MD).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # App
    APP_DOMAIN: str = "localhost"
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Lokaler Login: optionaler Bootstrap des ersten Admin-Kontos beim Start.
    # Nur wirksam, solange noch kein User mit dieser E-Mail existiert.
    INITIAL_ADMIN_EMAIL: str | None = None
    INITIAL_ADMIN_PASSWORD: str | None = None

    # OIDC (optional, beliebiger Provider: Authentik, Keycloak, Entra ID, Okta, ...)
    # Lokaler Login ist die primaere Anmeldemethode - OIDC ist eine optionale
    # Zweitmethode und wird nur aktiviert, wenn OIDC_ISSUER gesetzt ist.
    OIDC_ISSUER: str | None = None
    OIDC_CLIENT_ID: str | None = None
    OIDC_CLIENT_SECRET: str | None = None
    OIDC_REDIRECT_URI: str | None = None

    # SMTP (beliebiger Anbieter - nichts hier hart hinterlegt)
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_FROM_NAME: str = "HumanShield-Awareness"
    SMTP_FROM_EMAIL: str
    # TLS-Modus: "none" (Port 25), "starttls" (Port 587), "ssl" (implizit, Port 465)
    SMTP_TLS_MODE: str = "starttls"
    SMTP_VERIFY_SSL: bool = True
    SMTP_TIMEOUT: int = 10
    SMTP_BATCH_DELAY: int = 2  # Sekunden zwischen Batches - an Anbieter-Limit anpassen

    # Lizenzierung / Add-ons (Online-Aktivierung). Leer = reiner Open-Core-Betrieb ohne Add-ons.
    LICENSE_SERVER_URL: str = ""
    LICENSE_KEY: str = ""  # optionaler .env-Seed; kann auch im Dashboard gepflegt werden
    LICENSE_PRODUCT: str = "humanshield.app"
    LICENSE_REFRESH_INTERVAL_HOURS: int = 24


@lru_cache()
def get_settings() -> Settings:
    return Settings()
