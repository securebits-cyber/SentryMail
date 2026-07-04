"""LDAP-Anbindung fuer den Empfaenger-Import.

Provider-agnostisch: kennt keinen bestimmten Verzeichnisdienst, alle Werte
kommen aus der LdapConfig (Settings-Dashboard). Nutzt ldap3 (reines Python).
Der eigentliche Import folgt im Groups-Schritt; hier zunaechst der
Verbindungstest.
"""
import logging
from dataclasses import dataclass

from ldap3 import Connection, Server, Tls
from ldap3.core.exceptions import LDAPException

logger = logging.getLogger(__name__)


@dataclass
class LdapParams:
    host: str
    port: int
    use_ssl: bool
    start_tls: bool
    bind_dn: str
    bind_password: str | None
    base_dn: str
    user_filter: str
    attr_email: str
    attr_first_name: str
    attr_last_name: str


def _connect(params: LdapParams) -> Connection:
    tls = Tls() if (params.use_ssl or params.start_tls) else None
    server = Server(params.host, port=params.port, use_ssl=params.use_ssl, tls=tls, connect_timeout=10)
    conn = Connection(
        server,
        user=params.bind_dn or None,
        password=params.bind_password or None,
        auto_bind=False,
        receive_timeout=10,
    )
    conn.open()
    if params.start_tls and not params.use_ssl:
        conn.start_tls()
    if not conn.bind():
        raise LDAPException(f"Bind fehlgeschlagen: {conn.result.get('description', 'unbekannt')}")
    return conn


def test_connection(params: LdapParams) -> tuple[bool, str]:
    """Testet Bind + eine minimale Suche in der Base-DN. Gibt (Erfolg, Detail)."""
    try:
        conn = _connect(params)
        try:
            # Kleine Probe-Suche: bestaetigt Base-DN und Filter grundsaetzlich.
            conn.search(
                search_base=params.base_dn,
                search_filter=params.user_filter,
                attributes=[params.attr_email],
                size_limit=1,
            )
            found = len(conn.entries)
            return True, f"Verbindung und Bind erfolgreich. Testsuche lieferte {found} Treffer (Limit 1)."
        finally:
            conn.unbind()
    except LDAPException as e:
        logger.warning("LDAP-Test fehlgeschlagen: %s", e)
        return False, f"Fehler: {e}"
    except Exception as e:  # noqa: BLE001 - dem Nutzer die Rohmeldung zeigen
        logger.warning("LDAP-Test fehlgeschlagen: %s", e)
        return False, f"Fehler: {e}"


def fetch_users(params: LdapParams) -> list[dict]:
    """Sucht alle passenden Nutzer und liefert [{email, first_name, last_name}].

    Nutzt Paged Search, um auch groessere Verzeichnisse vollstaendig zu laden.
    Nur Eintraege mit vorhandener E-Mail werden zurueckgegeben.
    """
    conn = _connect(params)
    users: list[dict] = []
    try:
        entries = conn.extend.standard.paged_search(
            search_base=params.base_dn,
            search_filter=params.user_filter,
            attributes=[params.attr_email, params.attr_first_name, params.attr_last_name],
            paged_size=500,
            generator=True,
        )
        for entry_dict in entries:
            attrs = entry_dict.get("attributes")
            if not attrs:
                continue
            email = attrs.get(params.attr_email)
            if isinstance(email, (list, tuple)):
                email = email[0] if email else None
            if not email:
                continue
            first = attrs.get(params.attr_first_name)
            last = attrs.get(params.attr_last_name)
            if isinstance(first, (list, tuple)):
                first = first[0] if first else None
            if isinstance(last, (list, tuple)):
                last = last[0] if last else None
            users.append(
                {
                    "email": str(email),
                    "first_name": str(first) if first else None,
                    "last_name": str(last) if last else None,
                }
            )
    finally:
        conn.unbind()
    return users
