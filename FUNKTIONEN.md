# SentryMail — Funktionsübersicht

SentryMail ist eine selbstgehostete Phishing-Awareness-Plattform nach dem Open-Core-Modell. Der **Kern** steht unter der Mozilla Public License 2.0 und ist vollständig ohne Lizenz nutzbar. Zwei kostenpflichtige **Add-ons** ergänzen ihn; sie werden als eigene Pakete installiert, nicht als abgeschalteter Code im Kern mitgeliefert.

**Enterprise enthält alle Business-Funktionen, Business enthält alle Core-Funktionen.**

---

## Core (Open Source, MPL 2.0)

### Vorlagen

- **HTML- oder Markdown-Editor** (umschaltbar) mit Live-Vorschau; Markdown wird beim Speichern in HTML umgewandelt.
- **Personalisierungs-Variablen** in Betreff, HTML und Text: `{{ first_name }}`, `{{ last_name }}`, `{{ email }}`, `{{ link }}` sowie die Aliase `{{ recipient_name }}`, `{{ recipient_email }}`, `{{ click_link }}`.
- **Vorschau** mit Beispieldaten.
- **Anhänge** manuell hinzufügen und entfernen; sie werden mit der Kampagne versendet.

### Empfängergruppen

- Wiederverwendbare Empfängerlisten mit Name, Position, Abteilung und Kritikalität.
- Befüllen per **manueller Eingabe** oder **CSV** (Einfügen oder Datei).
- Kennzeichnung von **Leitungsorganen** für den gesonderten Nachweis nach § 38 BSIG.

### Sending Profiles

- SMTP-Zugangsdaten und Absender-Identität je Profil, mit Test-Mail-Funktion.
- **Anbieterunabhängig**: Host, Port, TLS-Modus und Zugangsdaten sind frei konfigurierbar (IONOS, Hetzner, Mailgun, SES, Postmark, eigener Mailserver …). Ohne Profil greift das globale Fallback-SMTP.

### Zustellung

- **Allowlisting-Generator** für Mail-Gateways: erzeugt fertige Konfigurationsschnipsel bzw. Schrittfolgen für **Exchange Online / Microsoft 365** (über `New-PhishSimOverridePolicy`, nicht über eine generische Transportregel), **Postfix**, **Proofpoint**, **Sophos** und **Barracuda**. Absender- und Tracking-Domain sind vorbefüllt. Die Profile sind pflegbare Datendateien — ein weiteres Gateway ist eine weitere Datei, kein Anbieter ist im Produktcode verdrahtet.
- **Zustell-Selbsttest** vor dem Kampagnenstart: eine Probemail über **denselben Weg wie die Kampagne** an ein eigenes Kanarienpostfach. Der IMAP-Zugang ist optional; ohne ihn wird ein gescheiterter Versand trotzdem erkannt. Ein IMAP-Problem wird nie als Zustellfehler ausgewiesen.
- **Zustelldiagnose** auf der Ergebnisseite jeder Kampagne: SMTP-Statuscodes je Empfänger (4xx vorübergehend, 5xx dauerhaft), Erkennung von **Greylisting** ab drei vorübergehenden Ablehnungen sowie eine Prüfung von **SPF, DMARC und Mehrfacheinträgen** der Absenderdomain. DKIM wird ausdrücklich als nicht prüfbar ausgewiesen statt vorgetäuscht.
- Ausgewertet werden Statuscodes und DNS-Einträge, keine Empfängermerkmale — eine Zustell-, keine Personenauswertung.

### Landing Pages

- Ziel des Klicks, als HTML oder Markdown.
- Optional **Daten-Capture** (abgeschickte Formulardaten als Signal), **Passworterfassung** (nur bei Bedarf) und **Weiterleitung** nach dem Absenden, etwa auf eine Aufklärungsseite.
- Formulare werden beim Ausliefern automatisch auf die Tracking-URL umgebogen.

### Kampagnen

- Assistent kombiniert Vorlage, Sending Profile, Landing Page und Empfängergruppen, optional mit **Zeitplanung**.
- Versand über **Senden**; unvollständig zugestellte Kampagnen bleiben für einen erneuten Lauf sendbar.

### Kampagnen-Preflight

- **Pflichtdialog vor jedem Start** mit Empfängerzahl nach Abzug der Ausschlüsse, betroffenen Gruppen, Versandzeitpunkt, Risikoklasse und allen Befunden. Ohne bestätigten Preflight startet keine Kampagne.
- **Ruhezeiten** (Fenster über Mitternacht ausdrücklich unterstützt), **Sperrfenster** für benannte Zeiträume wie Betriebsversammlung oder Jahresabschluss und ein **Cooldown** als Mindestabstand zwischen zwei Simulationen für dieselbe Person (Vorgabe 30 Tage). Gezählt werden Personen, nicht Vorgänge; nur tatsächlich versendete Kampagnen zählen.
- **Zeitzone** je Instanz als IANA-Name; voreingestellt ist UTC, weil keine Region verdrahtet wird. Eine unbekannte Zeitzone blockiert nichts.
- **Risikoklasse der Köder-Themen**, gepflegt an der Vorlage: *Hoch* (Gehalt, Kündigung, Gesundheit …) erzwingt eine Freigabe, *Mittel* weist nur hin, *Niedrig* ist der Regelfall. Die Themenliste ist eine pflegbare Datendatei und ausdrücklich ein Vorschlag.
- **Vier-Augen-Freigabe** bei hoher Risikoklasse, mit Begründung beantragt und von einer anderen Person entschieden. Dass Antragsteller und Entscheider verschieden sind, ist zusätzlich in der Datenbank abgesichert, nicht nur in der Anwendungslogik. Zuständig ist wahlweise die Administrator- oder die Datenschutz-/Personalratsrolle.
- Ein **Vorlagenwechsel widerruft** die Freigabe, eine reine Umbenennung nicht. Jede Änderung an Kampagne oder Ausschlüssen setzt die Bestätigung zurück.
- **Gruppenausschlüsse** direkt im Dialog, wirksam beim Versand und ohne Freitextfeld für den Grund — dort landeten sonst besonders schutzwürdige Daten.
- Nur harte Befunde blockieren (keine Empfänger, fehlende Freigabe); alles Übrige warnt und überlässt die Entscheidung dem Betreiber.

### Tracking und Ergebnisse

- **Tracking-Token je Empfänger**, eingebettet in Links und Zählpixel.
- Erfasst werden Versand, Öffnung, Klick und abgeschickte Formulardaten — je mit Zeitpunkt.
- **Ergebnisseite je Kampagne**: Gesamtkennzahlen und eine Tabelle pro Empfänger, dazu **CSV-Export**.
- **Control-Center-Dashboard** mit Kennzahlen, **Risiko-Score (0–100, Ampel)**, Trichter vom Versand bis zur Dateneingabe, Zeitverlauf und Heatmap.
- **Human Risk Management** — personenbezogene Risiko-Rangliste über alle Kampagnen.
- **Management Report** als konsolidierte Ansicht mit Kampagnenvergleich und Risikoverteilung.

### Benutzer und Rollen

- Rollen **Administrator**, **Datenschutzbeauftragter** und **Benutzer**.
- **Lokaler Login** als primäre Anmeldung, **OIDC/SSO** als optionale Zweitmethode (Authentik, Keycloak, Entra ID, Okta …).
- **Zwei-Faktor-Authentifizierung**: Authenticator-App oder E-Mail-Code, dazu Backup-Codes. Administratoren können 2FA verpflichtend machen — für alle oder nur für Administratoren.
- **Audit-Log** über Anmeldungen und Systemänderungen.

### Nachweiskette

- **Hash-Verkettung** jedes Audit-Eintrags mit dem Hash seines Vorgängers (SHA-256, lückenlose Position). Nachträgliche Änderung, Entfernung oder Vertauschung eines Eintrags bricht die Kette nachweisbar.
- **Kettenzustand im Dashboard** — Eintragszahl und Unversehrtheit, ein Bruch wird mit der betroffenen Position benannt.
- **Nachweispaket** als ZIP mit Einträgen, Manifest und zweisprachiger Prüfanleitung; auch über die API abrufbar. Zugriff haben Administratoren **und** der Datenschutzbeauftragte.
- **Eigenständiges Prüfwerkzeug** (`tools/sentrymail-verify/verify.py`): eine einzige Datei, nur Standardbibliothek, ohne Installation, Datenbank, Netz oder SentryMail. Es darf zusammen mit dem Paket an Prüfer weitergegeben werden.
- **Aufbewahrungsfrist für Audit-Inhalte** als eigenes Feld, bewusst getrennt von der Frist für Kampagnendaten. Gelöscht wird der Inhalt; Position, Zeitpunkt und Verkettung bleiben als *Tombstone* erhalten.
- Die Kette bezeugt den Zeitraum ab ihrer Einführung und behauptet nichts über die Zeit davor.

### Datenschutz und Mitbestimmung

- **Datenschutzmodus** mit serverseitig erzwungener **Sperre für Einzelpersonen-Auswertungen** — auch gegenüber Administratoren.
- **k-Anonymität** für Gruppenauswertungen (Standard 5); kleinere Gruppen werden als „unter Schwellenwert" ausgewiesen statt aufgeschlüsselt.
- **Vier-Augen-Freigabe** zur befristeten Aufhebung: beantragt von einem Administrator, entschieden von einem Datenschutzbeauftragten.
- **Aufbewahrungsfrist** mit automatischer Anonymisierung; ohne gesetzte Frist wird nichts gelöscht.
- **Client-Fingerprinting** nur nach ausdrücklicher Freigabe (Standard aus).
- **Vorlagen** für Betriebsvereinbarung und Datenschutz-Kurzdarstellung, jeweils auf Deutsch und Englisch.

### Betrieb

- **Docker Compose** (rootless, gehärtet), Caddy als Reverse Proxy mit automatischem TLS.
- **PostgreSQL** und **Redis**; alle Daten bleiben in der eigenen Installation.
- Oberfläche in **Deutsch und Englisch**, mit Light- und Dark-Mode.
- **Signierte Offline-Update-Bundles** für abgeschottete Instanzen ohne Internetzugang: Ed25519-Signatur über die rohen Manifest-Bytes, SHA-256 je Datei, Vollständigkeitsprüfung in **beide** Richtungen sowie `min_version` und Downgrade-Sperre. Kein Durchwinken bei fehlgeschlagener Prüfung; die Bundles sind **reproduzierbar** baubar.
- Eine `.env` im Bundle wird **erzwungen abgewiesen**, nicht nur ausgeschlossen — ein Update darf die Konfiguration der Instanz nie überschreiben.

---

## Business (Add-on)

### Verzeichnisse und Anmeldung

- **LDAP-Verzeichnisimport** von Empfängern, inklusive optionalem CA-Zertifikat für LDAPS und StartTLS.
- **Azure AD / Entra ID-Import** über Microsoft Graph, je Gruppe.
- **SCIM 2.0** — der Identity Provider legt Benutzer und Gruppen automatisch an und hält sie aktuell (Entra ID, Okta, Keycloak und andere). So verwaltete Gruppen sind im Dashboard schreibgeschützt.
- **Passkeys als zweiter Faktor** (WebAuthn) — Anmeldung per Fingerabdruck, Gesicht oder Sicherheitsschlüssel, mehrere Passkeys je Konto.

### Vorlagen und Angriffsarten

- **Vorlagen-Bibliothek** mit fertigen Awareness-Vorlagen (DHL, Amazon, Rechnung, Microsoft 365, HR, Bank, PayPal, LinkedIn, PDF-Köder, QR-Kampagne). Zu jeder Mail-Vorlage gehört eine passende **Landing Page**.
- **`.eml`-Import**: eine echte E-Mail hochladen — Betreff, HTML/Text und Anhänge werden übernommen.
- **KI-gestützte Erstellung** von Vorlagen und Landing Pages. Anbieter-neutral über eine konfigurierbare OpenAI-kompatible Schnittstelle: funktioniert mit OpenAI, Azure OpenAI, Mistral, Groq, OpenRouter oder lokalen Modellen wie Ollama, vLLM und LM Studio.
- **Angriffsarten**: **Spear Phishing** (persönlich adressiert), **Whaling** (Geschäftsführung) und **dateibasierte Angriffe** mit Köder-Anhang.
- **QR-Code-Phishing (Quishing)** — der Platzhalter `{{ qr_code }}` erzeugt je Empfänger einen QR-Code auf den Tracking-Link.

### Kampagnen-Tiefe

- **Wiederkehrende Kampagnen** — automatischer, terminierter Wiederversand in festem Intervall.
- **Mehrstufige Kampagnen** — Sequenzen aus mehreren Stufen mit eigener Vorlage und Verzögerung ab Start.

### Meldeweg

- **Meldung verdächtiger Mails**: Beschäftigte melden eine Mail, sie wird samt Originaldatei aufbewahrt und dedupliziert — Mehrfachmeldungen zählen hoch statt Duplikate anzulegen.
- **Mail-Report-Button** für **Thunderbird** (MailExtension) und **Outlook** (Office-Web-Add-in sowie VSTO für Postfächer ohne Exchange). Gemeldet wird ohne SentryMail-Konto über ein Melde-Token, begrenzt durch erlaubte Absenderdomains und ein Meldelimit je Person und Stunde.

### Auswertung und Nachweise

- **Passwortabfrage** auf Landing Pages mit aktivierter Erfassung: Formulardaten werden gespeichert, Passwortfelder **maskiert** und verschlüsselt abgelegt.
- **Business-Reporting**: **Executive Report** als Kurzfassung, **Trendanalyse** über die Zeit und **Benutzerentwicklung** je Person über alle Kampagnen.
- **PDF-Export** von Management Report und Kampagnenergebnissen, mit hinterlegtem **Logo und Firmendaten** als Kopf.
- **Nachweis-Center** mit je eigenem PDF-Dokument für **DSGVO** (Art. 32), **NIS2** (Art. 21), **ISO/IEC 27001** (A.6.3), **BSI ORP.3**, **§ 38 BSIG** (Schulungspflicht der Leitungsorgane), Awareness-Nachweis, Audit-Bericht, Zertifikat und Schulungsnachweise. Ausgabe als **PDF/A-3b** mit eingebetteten Schriften.
- **Webhooks** — bei jedem Tracking-Ereignis ein JSON-POST an konfigurierbare Adressen.

---

## Enterprise (Add-on)

### Darstellung und Automatisierung

- **White-Label** — eigenes Branding mit App-Name, Akzentfarben und Logo, app-weit einschließlich Login-Seite.
- **Automatische und risikoabhängige Kampagnen** — wählt Empfänger dynamisch nach Risiko (Daten abgeschickt, geklickt, alle) und versendet in festem Intervall.
- **AI-Scoring** — KI-gestützte, qualitative Einschätzung der Human-Risk-Kennzahlen mit priorisierten Maßnahmen.
- **Enterprise-Reporting** — Schulungsfortschritt und Zertifikatsstatus je Person, dazu individueller Bericht und persönliches Zertifikat als PDF.

### Anbindung an bestehende Systeme

- **SAML Single Sign-On** über einen beliebigen SAML-2.0-Identity-Provider (ADFS, Entra ID, Keycloak, Okta …); die Assertion muss signiert sein.
- **SIEM-Export** — jedes Tracking-Ereignis asynchron an **Splunk HEC**, **Elasticsearch**, **Microsoft Sentinel** oder als generisches JSON.

### Nachweise gegenüber Dritten

- **Zeitstempel eines Dritten nach RFC 3161** auf den Kopf der Nachweiskette: Er belegt, dass ein Kettenstand zu einem Zeitpunkt bereits existierte — die Lücke, die eine reine Hash-Kette offen lässt, weil die Uhr dem Serverbetreiber gehört. Die URL trägt der Betreiber ein, kein Anbieter ist verdrahtet.
- Das Token wird unverändert gespeichert und lässt sich herunterladen; geprüft wird extern mit `openssl ts -verify`. Ein fehlgeschlagener Stempel wird als Anker mit Status *failed* festgehalten statt verschwiegen.
- **Befristeter Auditoren-Zugang**, ausschließlich lesend und eigenständig protokolliert. Ein Ablaufdatum ist Pflicht, und der Zugang hängt an der Gewährung statt an einer neuen Rolle — so läuft er von selbst aus, statt als vergessene Rolle liegenzubleiben. Der Datenschutzmodus gilt weiter.

### Schulungsmodul (LMS)

- Selbstgehostete **Pflichtschulungen mit Videos** ohne Drittanbieter-CDN; Videospeicher im Dateisystem oder S3-kompatibel (etwa selbstgehostetes MinIO).
- **Automatische Kurszuweisung** bei Unterschreiten eines Awareness-Schwellwerts.
- **Manipulationssicheres Fortschritts-Tracking** — nur tatsächlich gesehene Wiedergabezeit zählt; der Server führt die Abschnitte selbst zusammen.
- **Verständnis-Quiz**, serverseitig bewertet, mit konfigurierbarer Bestehensgrenze.
- **Fristen** mit Erinnerungen und Eskalation bei Überschreitung — organisatorisch, ohne technische Sanktionen.
- **Revisionssichere Schulungsnachweise** als PDF mit Integritäts-Hash, auch nach Ablauf der Lizenz abrufbar.
- **SCORM-1.2-Import** (Beta) — eingekaufte Schulungen einbinden statt selbst produzieren.
- **xAPI-1.0.3-Export** an einen vorhandenen **Learning Record Store**; voreingestellt mit pseudonymer Kennung.

### Analyse gemeldeter Mails

- **Automatische Auswertung** jeder Meldung: Header und SPF/DKIM/DMARC-Ergebnisse, Absender-Ungereimtheiten, **entschärfte** URLs, Anhang-Hashes und ein regelbasierter, erklärbarer Score.
- **Wellen** — gleichartige Meldungen werden zusammengefasst, sortiert nach Verbreitung.
- **Anhang-Prüfung** über ein eigenes **ClamAV** und über **YARA**-Regeln des Betreibers.
- **MISP-Anreicherung** gegen eine eigene Threat-Intel-Instanz.
- Nicht erreichbare Prüfer gelten ausdrücklich als „nicht geprüft" — nie als „sauber".

### Wirksamkeit der eigenen Abwehr

- **Kontroll-Wirksamkeitstest** — misst, **welche Schutzschicht was abfängt**, bevor überhaupt ein Mensch etwas sieht. Acht Stufen: Anzeigenamen-Spoofing, Homoglyphen-Domain, SPF-Fehlschlag, gebrochene DKIM-Signatur, EICAR-Testdatei, Makro-Dokument, passwortgeschütztes Archiv und HTML-Smuggling. Die Batterie ist eine pflegbare Datendatei.
- **Ausschließlich an ein eigenes Testpostfach**, serverseitig erzwungen: Die Zieladresse wird gegen Kampagnenempfänger, Gruppenmitglieder und Benutzerkonten geprüft — bereits beim Speichern und vor dem Öffnen der Verbindung.
- Die Nutzlasten sind **bewusst harmlos**: EICAR statt Schadsoftware, Makro-Dokument ohne Makro, HTML-Smuggling ohne automatischen Download. Gemessen wird Erkennungsleistung, kein Schaden.
- Gelesen wird umgekehrt: **`blockiert` ist das gute Ergebnis.** Ein IMAP-Problem gilt nie als Testergebnis.
- **BSI-Zuordnung** je Stufe (APP.5.3.A4, APP.5.3.A5, NET.1.1.A3) als eigene Datendatei — ein Vorschlag zur Orientierung, der keine Bewertung der verantwortlichen Stelle ersetzt.

### Meldepflichten

- **NIS2-Meldeassistent** mit der Fristen-Uhr für Erstmeldung (24 Stunden), Folgemeldung (72 Stunden) und Abschlussbericht (ein Monat), gerechnet ab **Kenntnis** und in **Kalendertagen** — Wochenenden und Feiertage zählen.
- **Keine automatische Übermittlung.** Es gibt keinen Endpunkt zum BSI-Meldeportal und zu keiner Aufsichtsbehörde. Die Ausgabe ist ein Entwurf zum Herunterladen; gemeldet wird von der verantwortlichen Stelle selbst.
- **Keine Rechtsberatung**: Die Checkliste aus acht geführten Fragen strukturiert die Abwägung und berechnet nichts. Der Hinweis steht in der Oberfläche, in jedem Export und in jeder API-Antwort.
- **Begründungspflicht in beide Richtungen** — auch die Entscheidung *gegen* eine Meldung wird mit Grund festgehalten. Genau dieser Nachweis fehlt im Prüfungsfall regelmäßig.
- **DSGVO-Strang parallel** als eigener Vorgang mit eigener Uhr und anderem Adressaten (Art. 33, Landesaufsicht statt BSI). Eine Meldung ersetzt nie die andere.
- **Eskalation** an benannte Rollen, jeweils **mit Vertretung**, bei der Hälfte und bei 80 Prozent der Frist sowie bei Überschreitung — je Stufe genau einmal.
- Checklistenfragen und Portalfelder liegen als pflegbare Datendateien vor; Recht und Formulare ändern sich, dafür soll kein Release nötig sein.

### Reaktion

- **Massen-Quarantäne** — eine bestätigte Welle über **Microsoft Graph** oder **Postfix/Dovecot** aus allen Postfächern in einen Quarantäne-Ordner verschieben. Gesucht wird ausschließlich über die Message-ID, ein Probelauf ist zwingend, und es wird nur verschoben, nie gelöscht.

### Simulationen über weitere Kanäle

- **SMS** über ein generisches HTTP-Gateway — kein Anbieter ist fest verdrahtet, der Betreiber beschreibt den Rumpf seines Dienstes.
- **Matrix** und **Nextcloud Talk** als Direktnachricht, gedacht für selbstgehostete Instanzen.
- **USB-Drop** — ausgelegte Datenträger mit einer Kennung je Fundort. Die erzeugten Dateien enthalten kein Programm und kein Skript.
- Bespielt werden ausschließlich dienstliche Endgeräte, solange nichts anderes ausdrücklich freigegeben ist.
