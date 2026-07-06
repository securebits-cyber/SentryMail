# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer das Passwort-Hashing (Argon2id) des lokalen Logins."""
from app.utils.passwords import hash_password, verify_password


def test_hash_is_not_plaintext():
    password = "correct horse battery staple"
    hashed = hash_password(password)
    assert hashed != password
    assert password not in hashed
    assert hashed.startswith("$argon2")


def test_verify_correct_password():
    password = "correct horse battery staple"
    assert verify_password(password, hash_password(password)) is True


def test_verify_wrong_password():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("falsches-passwort", hashed) is False


def test_hashes_are_salted_and_unique():
    """Gleiches Passwort -> unterschiedliche Hashes (zufaelliger Salt)."""
    password = "same-password"
    assert hash_password(password) != hash_password(password)
