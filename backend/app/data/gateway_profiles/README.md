# Gateway-Profile / Gateway profiles

DE: Je Datei ein Mail-Gateway. Ein neues Gateway ist eine neue `.json` in diesem
Verzeichnis — kein Codeeingriff. Das ist Absicht: Kein Anbieter darf im
Produktcode verdrahtet sein.

EN: One mail gateway per file. Adding a gateway means adding a `.json` here — no
code change. That is deliberate: no vendor may be hard-wired into product code.

## Format

```jsonc
{
  "id": "kurzname",                  // eindeutig, = Dateiname ohne .json
  "order": 10,                       // Sortierung in der Oberflaeche
  "label": {"de": "...", "en": "..."},
  "vendor_docs": "https://...",      // optional, Herstellerdoku
  "inputs": ["sender_domain", "sender_ips", "tracking_domain"],
  "snippets": [
    {
      "id": "...",
      "title": {"de": "...", "en": "..."},
      "kind": "code",                // "code" oder "steps"
      "language": "powershell",      // nur bei kind=code
      "code": "... {{sender_domain}} ...",
      "steps": {"de": ["..."], "en": ["..."]},   // nur bei kind=steps
      "note": {"de": "...", "en": "..."}          // optional
    }
  ]
}
```

## Platzhalter

`{{sender_domain}}`, `{{sender_ips}}`, `{{tracking_domain}}` werden beim Rendern
ersetzt. Doppelte geschweifte Klammern, damit weder PowerShell-Variablen (`$x`)
noch Konfigurationssyntax mit `{}` kollidieren.

Nicht belegte Platzhalter bleiben als `{{name}}` stehen — sichtbar statt still
leer, sonst entsteht eine Konfiguration mit einem stillen Loch.
