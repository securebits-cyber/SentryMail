# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Schlanker, Redis-gestützter Fehlversuchs-Zähler für Brute-Force-Schutz.

Fenster-basiert: jeder Fehlversuch zählt einen Schlüssel hoch (mit TTL). Ab einer
Obergrenze gilt der Schlüssel als gesperrt. Erfolgreiche Vorgänge setzen ihn
zurück. Faellt Redis aus, wird bewusst *fail-open* verfahren (erlauben statt
sperren) — eine Cache-Störung soll keinen kompletten Login-Ausfall verursachen.
"""
from __future__ import annotations

import logging

import redis

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: redis.Redis | None = None


def _r() -> redis.Redis | None:
    global _client
    if _client is None:
        try:
            _client = redis.from_url(get_settings().REDIS_URL, decode_responses=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Rate-Limit: Redis nicht initialisierbar: %s", exc)
            return None
    return _client


def is_locked(key: str, *, limit: int) -> bool:
    """True, wenn im aktuellen Fenster bereits >= limit Fehlversuche gezählt wurden."""
    r = _r()
    if r is None:
        return False  # fail-open
    try:
        val = r.get(key)
    except redis.RedisError as exc:
        logger.warning("Rate-Limit: Redis-Lesefehler (%s) -> fail-open", exc)
        return False
    return bool(val) and int(val) >= limit


def register_failure(key: str, *, window_seconds: int) -> int:
    """Zählt einen Fehlversuch (mit TTL) und gibt die aktuelle Anzahl zurück."""
    r = _r()
    if r is None:
        return 0
    try:
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = pipe.execute()
        return int(count)
    except redis.RedisError as exc:
        logger.warning("Rate-Limit: Redis-Schreibfehler (%s) -> fail-open", exc)
        return 0


def reset(key: str) -> None:
    """Zähler nach erfolgreichem Vorgang löschen."""
    r = _r()
    if r is None:
        return
    try:
        r.delete(key)
    except redis.RedisError as exc:
        logger.warning("Rate-Limit: Redis-Löschfehler (%s)", exc)
