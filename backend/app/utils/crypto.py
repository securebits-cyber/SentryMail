# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Symmetrische Verschluesselung fuer at-rest gespeicherte Secrets.

Wird u. a. fuer SMTP-Passwoerter der Sending Profiles genutzt: diese liegen
verschluesselt in der DB (nicht im Klartext). Der Schluessel wird deterministisch
aus SECRET_KEY abgeleitet - dreht man SECRET_KEY, werden bestehende Chiffrate
unlesbar (bewusste Kopplung an das zentrale App-Secret).
"""
import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import get_settings


def _fernet() -> Fernet:
    secret = get_settings().SECRET_KEY.encode()
    # Fernet erwartet einen 32-Byte urlsafe-b64 Schluessel; SECRET_KEY ist
    # beliebig lang -> ueber SHA-256 auf genau 32 Byte normalisieren.
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
