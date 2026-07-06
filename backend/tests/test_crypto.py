# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die at-rest-Verschluesselung (Fernet) der UI-gepflegten Secrets."""
import pytest
from cryptography.fernet import InvalidToken

from app.utils.crypto import decrypt, encrypt


def test_encrypt_decrypt_roundtrip():
    plaintext = "s3cret-smtp-passwort"
    assert decrypt(encrypt(plaintext)) == plaintext


def test_ciphertext_is_not_plaintext():
    """Das Secret darf im Chiffrat nicht im Klartext erscheinen (at-rest-Anforderung)."""
    plaintext = "s3cret-smtp-passwort"
    ciphertext = encrypt(plaintext)
    assert plaintext not in ciphertext
    assert ciphertext != plaintext


def test_encrypt_is_nondeterministic():
    """Fernet nutzt eine IV -> zwei Chiffrate desselben Klartexts unterscheiden sich."""
    assert encrypt("same") != encrypt("same")


def test_tampered_ciphertext_rejected():
    ciphertext = encrypt("payload")
    tampered = ciphertext[:-4] + ("aaaa" if not ciphertext.endswith("aaaa") else "bbbb")
    with pytest.raises(InvalidToken):
        decrypt(tampered)


def test_unicode_roundtrip():
    plaintext = "Paßwört-mit-Ümläüten-🔐"
    assert decrypt(encrypt(plaintext)) == plaintext
