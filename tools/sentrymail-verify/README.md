# SentryMail-Verifier

DE: Prüft ein Nachweispaket (Audit-Log als Hash-Kette) **ohne SentryMail** —
ohne Datenbank, ohne Netz, ohne Installation. Eine einzige Datei, die nur die
Python-Standardbibliothek benutzt.

```
python verify.py sentrymail-nachweis-20260726-120000.zip
python verify.py --lang en paket.zip
```

Exit-Code `0` = Kette in Ordnung, `1` = Bruch gefunden, `2` = Paket unlesbar.

Das Paket exportiert man im Dashboard unter *Einstellungen → Aktivität* oder
über `GET /audit-events/evidence-package`.

Diese Datei darf zusammen mit dem Paket weitergegeben werden: Ein Prüfer soll
die Kette nachrechnen können, ohne uns fragen zu müssen — und den Quelltext des
Prüfwerkzeugs selbst lesen können.

EN: Verifies an evidence package (audit log as a hash chain) **without
SentryMail** — no database, no network, no installation. A single file using
only the Python standard library.

Exit code `0` means the chain is intact, `1` a break was found, `2` the package
is unreadable.

Hand this file out together with the package: an auditor should be able to
recompute the chain without asking us — and read the source of the verifying
tool themselves.
