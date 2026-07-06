/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Zentrale Anleitungstexte fuer den Hilfe-Bereich rechts (PageScaffold),
// zweisprachig (DE/EN). Key = guidanceKey der jeweiligen Seite.
import type { Lang } from '../i18n/translations'

export interface Guidance {
  intro: string
  steps: string[]
  note?: string
  variables?: { name: string; desc: string }[]
}

const de: Record<string, Guidance> = {
  'template-editor': {
    intro:
      'So baust du eine Vorlage auf. Betreff, HTML- und Text-Inhalt können Platzhalter enthalten, die pro Empfänger automatisch ersetzt werden.',
    steps: [
      'Namen und einen realistischen Betreff vergeben — der Betreff entscheidet oft, ob die Mail geöffnet wird.',
      'HTML-Inhalt gestalten und den Tracking-Link über {{ link }} einbauen — nur so werden Klicks der Landing Page zugeordnet.',
      'Mit Variablen personalisieren (z. B. {{ first_name }}); das macht die Mail glaubwürdiger.',
      'Optional einen Text-Teil als Plain-Text-Alternative hinterlegen.',
      'Über „Vorschau (mit Beispieldaten)“ prüfen, wie die Mail beim Empfänger ankommt.',
    ],
    variables: [
      { name: '{{ first_name }}', desc: 'Vorname des Empfängers' },
      { name: '{{ last_name }}', desc: 'Nachname des Empfängers' },
      { name: '{{ email }}', desc: 'E-Mail-Adresse des Empfängers' },
      { name: '{{ link }}', desc: 'Personalisierter Tracking-Link zur Landing Page' },
    ],
    note: 'Gleichbedeutende Aliase: {{ recipient_name }}, {{ recipient_email }}, {{ click_link }}.',
  },
  templates: {
    intro:
      'Vorlagen sind die Phishing-E-Mails, die in Kampagnen versendet werden. Betreff und Inhalt können Platzhalter wie den Vornamen oder den Tracking-Link enthalten.',
    steps: [
      'Aussagekräftigen Namen und einen realistischen Betreff wählen — er entscheidet oft, ob die Mail geöffnet wird.',
      'HTML-Inhalt gestalten und über die Personalisierungs-Variablen (z. B. Vorname) glaubwürdiger machen.',
      'Den Tracking-Link/Platzhalter einbauen, damit Klicks der Landing Page zugeordnet werden.',
      'Optional einen Text-Teil hinterlegen, damit die Mail auch ohne HTML sauber ankommt.',
      'Über die Vorschau prüfen, wie die Mail beim Empfänger aussieht.',
    ],
    note: 'Vorlagen lassen sich in mehreren Kampagnen wiederverwenden.',
  },
  groups: {
    intro:
      'Gruppen sind wiederverwendbare Empfängerlisten für deine Kampagnen. Empfänger kannst du manuell, per CSV oder aus dem LDAP-Verzeichnis übernehmen.',
    steps: [
      'Neue Gruppe anlegen und einen sprechenden Namen vergeben (z. B. „Abteilung Vertrieb“).',
      'Empfänger manuell erfassen oder per CSV importieren (E-Mail, Vorname, Nachname).',
      'Alternativ „LDAP-Import“ nutzen — dazu muss LDAP unter Einstellungen konfiguriert sein.',
      'Vor dem Versand prüfen, dass alle E-Mail-Adressen korrekt sind.',
    ],
    note: 'Eine Gruppe kann in mehreren Kampagnen gleichzeitig verwendet werden.',
  },
  'sending-profiles': {
    intro:
      'Ein Sending Profile bündelt SMTP-Zugangsdaten und Absender-Identität für den Kampagnen-Versand. Ohne Profil greift das globale Fallback-SMTP.',
    steps: [
      'SMTP-Host und Port des Anbieters eintragen und den passenden TLS-Modus wählen.',
      'Benutzername und Passwort hinterlegen — das Passwort wird verschlüsselt gespeichert.',
      'Absender-Adresse und -Name setzen; die Adresse muss beim Anbieter versandberechtigt sein (SPF/DKIM).',
      'Mit „Test-Mail“ an eine eigene Adresse den Versand prüfen, bevor eine Kampagne läuft.',
    ],
    note: 'Für jede Absender-Identität kannst du ein eigenes Profil anlegen.',
  },
  'landing-editor': {
    intro:
      'Landing Pages sind die Seiten, auf denen Empfänger nach dem Klick landen. Optional erfassen sie Formulareingaben, um einen Awareness-Moment zu erzeugen.',
    steps: [
      'Namen vergeben und den Seiteninhalt gestalten — als HTML oder im Markdown-Modus (z. B. eine nachgebaute Login-Seite).',
      'Für ein Eingabeformular HTML verwenden; alle Formulare werden beim Ausliefern automatisch auf die Tracking-URL umgebogen.',
      '„Daten-Capture“ aktivieren, wenn abgeschickte Formulardaten als Signal erfasst werden sollen.',
      'Passwörter nur erfassen, wenn wirklich nötig — Datenschutz und interne Richtlinien beachten.',
      'Optional eine Weiterleitung oder Aufklärungsseite nach dem Absenden hinterlegen.',
    ],
    note: 'Erfasste Daten dienen nur Trainingszwecken; kläre die Zulässigkeit vorab intern ab.',
  },
  'landing-pages': {
    intro:
      'Landing Pages sind die Seiten, auf denen Empfänger nach einem Klick landen. Sie können optional Eingaben erfassen, um Awareness-Momente zu erzeugen.',
    steps: [
      'Namen vergeben und den HTML-Inhalt der Seite gestalten (z. B. eine nachgebaute Login-Seite).',
      'Bei Bedarf „Daten-Capture“ aktivieren, um eingegebene Formulardaten zu erfassen.',
      'Passwörter nur erfassen, wenn wirklich nötig — beachte Datenschutz und interne Richtlinien.',
      'Optional eine Aufklärungs-/Weiterleitungsseite nach dem Absenden hinterlegen.',
    ],
    note: 'Erfasste Daten dienen nur Trainingszwecken; kläre die Zulässigkeit vorab intern ab.',
  },
  'campaign-editor': {
    intro:
      'Eine Kampagne bündelt Vorlage, Absender, Landing Page und Empfängergruppen. Der Versand wird danach separat über „Senden“ gestartet.',
    steps: [
      'Namen vergeben und die E-Mail-Vorlage auswählen (Pflicht) — sie muss vorher unter „Vorlagen“ angelegt sein.',
      'Sending Profile für die Absender-Identität wählen; ohne Auswahl greift das globale Fallback-SMTP.',
      'Optional eine Landing Page hinterlegen, auf der Empfänger nach dem Klick landen.',
      'Eine oder mehrere Empfängergruppen auswählen (unter „Gruppen“ anlegen oder importieren).',
      'Optional Datum und Uhrzeit für einen geplanten Start setzen.',
      'Kampagne anlegen und anschließend in der Übersicht über „Senden“ starten — danach die Ergebnisse auswerten.',
    ],
    note: 'Starte im Zweifel mit einer kleinen Testgruppe.',
  },
  campaigns: {
    intro:
      'In einer Kampagne kombinierst du Vorlage, Sending Profile, Landing Page und Empfängergruppe und startest den Versand.',
    steps: [
      'Vorher sicherstellen, dass Vorlage, Gruppe und (optional) Landing Page angelegt sind.',
      'Neue Kampagne anlegen und die Bausteine im Assistenten auswählen.',
      'Absender über ein Sending Profile festlegen — sonst wird das globale Fallback-SMTP genutzt.',
      'Kampagne speichern und anschließend über „Senden“ den Versand starten.',
      'Nach dem Versand die Ergebnisse (Öffnungen, Klicks, Eingaben) auswerten.',
    ],
    note: 'Starte im Zweifel mit einer kleinen Testgruppe.',
  },
  results: {
    intro:
      'Die Ergebnisse zeigen pro Empfänger, wie auf die Kampagne reagiert wurde — von Zustellung über Öffnung bis Klick und Eingabe.',
    steps: [
      'Die Kennzahlen oben geben den Überblick über die gesamte Kampagne.',
      'In der Tabelle je Empfänger den Status nachvollziehen.',
      'Über „Als CSV exportieren“ die Rohdaten für Reports herunterladen.',
    ],
    note: 'Nutze die Ergebnisse für gezielte Awareness-Maßnahmen, nicht zur Sanktionierung Einzelner.',
  },
  users: {
    intro:
      'Hier verwaltest du die lokalen Konten für den Zugang zu HumanShield.APP. Der lokale Login ist die primäre Anmeldemethode.',
    steps: [
      '„Neuer Benutzer“ öffnen und E-Mail, Name, Startpasswort und Rolle festlegen.',
      'Rolle wählen: „Admin“ darf Einstellungen und Benutzer verwalten, „Benutzer“ nur Kampagnen-Funktionen.',
      'Konten bei Bedarf deaktivieren statt löschen, um den Zugang temporär zu sperren.',
    ],
    note: 'Bei aktivem OIDC müssen Nutzer trotzdem als lokale Konten mit passender E-Mail existieren.',
  },
  profile: {
    intro: 'Hier änderst du deinen angezeigten Namen und dein Passwort.',
    steps: [
      'Namen anpassen und speichern.',
      'Zum Passwortwechsel das aktuelle Passwort und zweimal das neue eingeben.',
      'Ein starkes, einzigartiges Passwort verwenden.',
    ],
    note: 'Deine E-Mail-Adresse und Rolle kann nur ein Admin ändern.',
  },
  'settings-ldap': {
    intro:
      'Über LDAP importierst du E-Mail-Empfänger direkt aus deinem Verzeichnisdienst (z. B. Active Directory oder OpenLDAP) in Gruppen.',
    steps: [
      'Host und Port des LDAP-Servers eintragen (Standard: 389, LDAPS: 636).',
      'Verschlüsselung wählen: LDAPS (SSL) oder StartTLS — für Produktivbetrieb empfohlen.',
      'Bind-DN eines Dienstkontos mit Lesezugriff angeben, z. B. cn=svc,ou=service,dc=example,dc=com.',
      'Das Bind-Passwort eintragen — es wird verschlüsselt gespeichert und nie wieder angezeigt.',
      'Base-DN setzen, unterhalb dessen nach Benutzern gesucht wird, z. B. ou=users,dc=example,dc=com.',
      'Bei Bedarf User-Filter und Attribut-Mapping anpassen (AD: E-Mail meist „mail“, Vorname „givenName“, Nachname „sn“).',
      '„Verbindung testen“ klicken — speichert die Werte und prüft Verbindung und Anmeldung.',
    ],
    note: 'Der Import selbst erfolgt anschließend unter Gruppen → „LDAP-Import“.',
  },
  'settings-oidc': {
    intro:
      'OIDC ist eine optionale Zweitanmeldung per Single Sign-On. Der lokale Login bleibt die primäre Methode — ohne OIDC läuft die App vollständig.',
    steps: [
      'Im Identity Provider (Authentik, Keycloak, Entra ID, Okta, …) eine neue OIDC-Anwendung anlegen.',
      'Als Redirect-URI die Callback-Adresse eintragen: https://<deine-domain>/api/auth/callback.',
      'Issuer-URL aus dem IdP kopieren (Basis-URL der OIDC-Discovery).',
      'Client-ID und Client-Secret übernehmen — das Secret wird verschlüsselt gespeichert.',
      'Speichern und dann „OIDC aktivieren“ einschalten: auf der Anmeldeseite erscheint der SSO-Button.',
    ],
    note: 'Nutzer müssen als lokale Konten mit passender E-Mail existieren, damit die SSO-Anmeldung zugeordnet werden kann.',
  },
  'settings-smtp': {
    intro:
      'Das globale Fallback-SMTP wird nur genutzt, wenn eine Kampagne kein eigenes Sending Profile hat. Für eigene Absender-Identitäten lege besser ein Sending Profile an.',
    steps: [
      'Host und Port deines SMTP-Anbieters eintragen (funktioniert mit jedem Anbieter: IONOS, Hetzner, Mailgun, eigener Server, …).',
      'TLS-Modus passend zum Port wählen: STARTTLS für Port 587, SSL/TLS für Port 465, unverschlüsselt nur für Port 25 im internen Netz.',
      'Benutzername und Passwort des Postfachs eintragen — das Passwort wird verschlüsselt gespeichert.',
      'Absender-Adresse und -Name setzen; die Adresse muss beim Anbieter zum Versand berechtigt sein (SPF/DKIM beachten).',
      '„Verbindung testen“ klicken — speichert die Werte und prüft Verbindung und Anmeldung.',
    ],
    note: 'Bei einer frischen Installation ist diese Seite mit den SMTP-Werten aus der .env vorbefüllt.',
  },
  recurring: {
    intro:
      'Wiederkehrende Kampagnen versenden in festem Intervall automatisch eine neue Iteration an dieselben Gruppen — ideal für kontinuierliche Awareness.',
    steps: [
      'Vorlage, Sending Profile und Landing Page auswählen wie bei einer normalen Kampagne.',
      'Empfängergruppen zuweisen — bei jeder Fälligkeit werden daraus frische Empfänger mit neuen Tracking-Token erzeugt.',
      'Intervall in Tagen festlegen (z. B. 30) und die Automatik aktivieren.',
      'Ergebnisse je Iteration findest du wie bei einzelnen Kampagnen unter den Kampagnen-Ergebnissen.',
    ],
    note: 'Business-Funktion. Der Scheduler löst die Fälligkeiten serverseitig aus — es muss niemand angemeldet sein.',
  },
  multistage: {
    intro:
      'Mehrstufige Kampagnen versenden eine Abfolge von Vorlagen an dieselben Empfänger, jeweils mit zeitlichem Abstand — z. B. Köder, dann Erinnerung.',
    steps: [
      'Name, Gruppen, Sending Profile und Landing Page festlegen.',
      'Stufen hinzufügen: je Stufe eine Vorlage und eine Verzögerung in Tagen ab Kampagnenstart.',
      'Reihenfolge und Abstände prüfen und die Kampagne starten.',
      'Der Fortschritt (versendete Stufen) wird je Kampagne mitgezählt.',
    ],
    note: 'Business-Funktion. Die Stufen werden automatisch fällig — kein manuelles Nachfassen nötig.',
  },
  'auto-campaigns': {
    intro:
      'Automatische, risikoabhängige Kampagnen wählen Empfänger dynamisch nach Risiko aus und versenden in festem Intervall — gezielt an die, die es am nötigsten haben.',
    steps: [
      'Vorlage, Sending Profile und Landing Page auswählen.',
      'Risiko-Ziel wählen: „Daten abgeschickt“, „geklickt“ oder „alle“ — danach werden die Empfänger bestimmt.',
      'Intervall in Tagen setzen und aktivieren.',
      'Bei jeder Fälligkeit ermittelt das System die passenden Empfänger neu und versendet automatisch.',
    ],
    note: 'Enterprise-Funktion. Baut auf dem Human-Risk-Score der Empfänger auf.',
  },
  reports: {
    intro:
      'Die Berichte bündeln Kennzahlen, Risiko und Nachweise. Der obere Teil ist Open Core; Benutzerentwicklung, Abteilungsvergleich und PDF-Nachweise sind Business, Schulungsfortschritt und KI-Risikoanalyse Enterprise.',
    steps: [
      'Management Report oben gibt den Gesamtüberblick (Kennzahlen, Kampagnenvergleich, Risikoverteilung) — als CSV/PDF exportierbar.',
      'Benutzerentwicklung und Abteilungsvergleich zeigen, wo das Risiko konzentriert ist.',
      'KI-Risikoanalyse erstellt auf Knopfdruck eine Einschätzung mit priorisierten Maßnahmen (benötigt eine konfigurierte KI-Anbindung).',
      'Unter „Nachweise & Zertifikate“ lädst du Compliance-Dokumente (DSGVO, NIS2, ISO 27001 …) als PDF.',
    ],
    note: 'Gesperrte Abschnitte werden erst mit passender Lizenz mit Daten gefüllt.',
  },
  integrations: {
    intro:
      'Der Integrationsbereich bündelt Verbindungen zu externen Systemen (SIEM, Verzeichnisdienste, SSO) sowie die lizenzabhängigen Zusatzfunktionen.',
    steps: [
      'In der linken Spalte den gewünschten Bereich wählen (analog zum Einstellungen-Menü).',
      'Business-/Enterprise-Integrationen sind mit einem Lizenz-Badge markiert und ohne gültige Lizenz gesperrt.',
      'Die eigentliche Konfiguration (z. B. LDAP, SIEM, SAML) erfolgt in den jeweiligen Einstellungsseiten.',
    ],
    note: 'Neue Integrationen erscheinen hier automatisch, sobald sie per Lizenz freigeschaltet sind.',
  },
  'settings-entra': {
    intro:
      'Über Azure AD / Entra ID importierst du Empfänger direkt aus dem Microsoft-Verzeichnis (Graph API, App-Registrierung mit Client-Credentials).',
    steps: [
      'In Entra eine App-Registrierung anlegen und die Berechtigung zum Lesen von Benutzern/Gruppen erteilen.',
      'Tenant-ID, Client-ID und Client-Secret hier eintragen — das Secret wird verschlüsselt gespeichert.',
      'Integration aktivieren; anschließend unter „Gruppen → Entra-Import“ eine Gruppe importieren.',
    ],
    note: 'Business-Funktion. Das Client-Secret wird über die API nie zurückgegeben (nur ein has_*-Flag).',
  },
  'settings-webhooks': {
    intro:
      'Webhooks senden bei jedem Tracking-Ereignis (Öffnung, Klick, Absenden) einen JSON-POST an eine oder mehrere URLs — z. B. für Ticketing oder eigene Automationen.',
    steps: [
      'Ziel-URL des empfangenden Systems eintragen und den Webhook aktivieren.',
      'Optional mehrere URLs anlegen — jedes Ereignis wird an alle aktiven Webhooks zugestellt.',
      'Beim Empfänger die eingehenden JSON-Payloads verarbeiten (Ereignistyp, Empfänger, Kampagne, Zeit).',
    ],
    note: 'Business-Funktion. Die Zustellung erfolgt asynchron und blockiert das Tracking nicht.',
  },
  'settings-whitelabel': {
    intro:
      'White-Label passt das Erscheinungsbild an dein Unternehmen an: App-Name, Akzentfarben und Logo — app-weit inkl. Login-Seite.',
    steps: [
      'App-Namen setzen (erscheint in Kopfzeile und Titel).',
      'Primär- und Verlaufs-Akzentfarbe wählen, passend zum Corporate Design.',
      'Optional ein Logo hochladen (wird als Data-URI gespeichert).',
      'Speichern — die Änderungen greifen sofort; die Login-Seite nach dem nächsten Abmelden.',
    ],
    note: 'Enterprise-Funktion.',
  },
  'settings-siem': {
    intro:
      'Der SIEM-Export leitet jedes Tracking-Ereignis an ein SIEM weiter: Splunk HEC, Elasticsearch, Microsoft Sentinel oder generisches JSON.',
    steps: [
      'Format des Ziel-SIEM wählen.',
      'Endpoint-URL und Token/API-Key eintragen — der Token wird verschlüsselt gespeichert.',
      'Optional einen Index/eine Quelle angeben (z. B. Splunk-Index).',
      'Mit „Verbindung testen“ ein Testereignis senden, dann aktivieren.',
    ],
    note: 'Enterprise-Funktion. Die Zustellung erfolgt asynchron je Ereignis.',
  },
  'settings-saml': {
    intro:
      'SAML Single Sign-On erlaubt die Anmeldung über einen SAML-2.0-Identity-Provider (ADFS, Entra ID, Keycloak, Okta …) als optionale Zweitmethode.',
    steps: [
      'Beim IdP eine Anwendung anlegen; die SP-Metadaten dieser App (Button „SP-Metadaten“) dort importieren.',
      'IdP-Entity-ID, SSO-URL und Signatur-Zertifikat hier eintragen; SP-Entity-ID und ACS-URL setzen.',
      'Optional das Attribut-Mapping für E-Mail/Anzeigename füllen (leer = NameID als E-Mail).',
      'Aktivieren — auf der Login-Seite erscheint dann ein SAML-SSO-Button.',
    ],
    note: 'Enterprise-Funktion. Die Assertion muss signiert sein; Signatur, Gültigkeit und Audience werden geprüft.',
  },
  'settings-ai': {
    intro:
      'Die KI-Anbindung ist anbieter-neutral: sie spricht eine OpenAI-kompatible API an und treibt die KI-Erstellung von Vorlagen/Landing Pages sowie das AI-Scoring.',
    steps: [
      'Anbieter frei wählen (OpenAI, Azure OpenAI, Anthropic-kompatibel, Mistral, Groq, OpenRouter oder lokal via Ollama/vLLM/LM Studio).',
      'Basis-URL (…/v1), Modell und API-Key eintragen — der Key wird verschlüsselt gespeichert.',
      'Mit „Verbindung testen“ prüfen und aktivieren.',
      'Danach erscheint in den Editoren „Mit KI erstellen“, und die KI-Risikoanalyse ist nutzbar.',
    ],
    note: 'Business-Funktion. Es wird nie ein Anbieter im Code fest verdrahtet.',
  },
  'settings-security': {
    intro:
      'Hier legst du die sicherheitsrelevanten Richtlinien fest — etwa die Erzwingung von Zwei-Faktor-Authentifizierung.',
    steps: [
      'Richtlinien nach Bedarf setzen (z. B. 2FA verpflichtend).',
      'Änderungen speichern — sie gelten ab der nächsten Anmeldung.',
      'Die eigene 2FA-Methode richtest du unter „Mein Profil“ ein.',
    ],
    note: 'Änderungen an Sicherheitsrichtlinien werden im Audit-Log protokolliert.',
  },
  'settings-license': {
    intro:
      'Über die Lizenz schaltest du die Business- und Enterprise-Funktionen frei. Ohne Lizenz läuft die Open-Core-Version vollständig.',
    steps: [
      'Lizenzschlüssel eintragen und aktivieren — der Status (Kunde, Ablauf, Features) wird angezeigt.',
      'Freigeschaltete Funktionen erscheinen danach ohne Sperr-Symbol.',
      'Der Status wird regelmäßig automatisch aktualisiert.',
    ],
    note: 'Ohne Lizenzschlüssel bleiben Business-/Enterprise-Bereiche sichtbar, aber gesperrt.',
  },
  'settings-audit': {
    intro:
      'Das Audit-Log zeichnet Anmelde-Ereignisse (Erfolg/Fehlschlag/blockiert) und Systemänderungen (Benutzer, Einstellungen, 2FA) mit Zeitstempel und IP auf.',
    steps: [
      'Die Liste zeigt die jüngsten Ereignisse zuerst.',
      'Nach Anmeldeproblemen hier nach fehlgeschlagenen/blockierten Logins suchen.',
      'Änderungen an Einstellungen und Konten sind hier nachvollziehbar dokumentiert.',
    ],
    note: 'Das Audit-Log dient auch als Nachweis für Compliance-Anforderungen.',
  },
}

const en: Record<string, Guidance> = {
  'template-editor': {
    intro:
      'How to build a template. Subject, HTML and text content can contain placeholders that are replaced automatically per recipient.',
    steps: [
      'Give it a name and a realistic subject — the subject often decides whether the mail gets opened.',
      'Design the HTML content and add the tracking link via {{ link }} — only then are clicks attributed to the landing page.',
      'Personalize with variables (e.g. {{ first_name }}); this makes the mail more credible.',
      'Optionally add a text part as a plain-text alternative.',
      'Use “Preview (with sample data)” to check how the mail looks to the recipient.',
    ],
    variables: [
      { name: '{{ first_name }}', desc: 'Recipient’s first name' },
      { name: '{{ last_name }}', desc: 'Recipient’s last name' },
      { name: '{{ email }}', desc: 'Recipient’s email address' },
      { name: '{{ link }}', desc: 'Personalized tracking link to the landing page' },
    ],
    note: 'Equivalent aliases: {{ recipient_name }}, {{ recipient_email }}, {{ click_link }}.',
  },
  templates: {
    intro:
      'Templates are the phishing emails sent in campaigns. Subject and content can contain placeholders such as the first name or the tracking link.',
    steps: [
      'Choose a meaningful name and a realistic subject — it often decides whether the mail gets opened.',
      'Design the HTML content and make it more credible with personalization variables (e.g. first name).',
      'Add the tracking link/placeholder so clicks are attributed to the landing page.',
      'Optionally add a text part so the mail arrives cleanly even without HTML.',
      'Use the preview to check how the mail looks to the recipient.',
    ],
    note: 'Templates can be reused across multiple campaigns.',
  },
  groups: {
    intro:
      'Groups are reusable recipient lists for your campaigns. You can add recipients manually, via CSV or from the LDAP directory.',
    steps: [
      'Create a new group and give it a descriptive name (e.g. “Sales department”).',
      'Enter recipients manually or import them via CSV (email, first name, last name).',
      'Alternatively use “LDAP import” — this requires LDAP to be configured under Settings.',
      'Before sending, check that all email addresses are correct.',
    ],
    note: 'A group can be used in several campaigns at the same time.',
  },
  'sending-profiles': {
    intro:
      'A sending profile bundles SMTP credentials and sender identity for campaign delivery. Without a profile the global fallback SMTP is used.',
    steps: [
      'Enter the provider’s SMTP host and port and choose the matching TLS mode.',
      'Enter username and password — the password is stored encrypted.',
      'Set the sender address and name; the address must be authorized to send at the provider (SPF/DKIM).',
      'Use “Test email” to a mailbox of your own to check delivery before running a campaign.',
    ],
    note: 'You can create a separate profile for each sender identity.',
  },
  'landing-editor': {
    intro:
      'Landing pages are the pages recipients land on after clicking. Optionally they capture form input to create an awareness moment.',
    steps: [
      'Give it a name and design the page content — as HTML or in markdown mode (e.g. a cloned login page).',
      'For an input form use HTML; all forms are automatically rewritten to the tracking URL on delivery.',
      'Enable “data capture” if submitted form data should be recorded as a signal.',
      'Only capture passwords if truly necessary — mind data protection and internal policies.',
      'Optionally add a redirect or awareness page after submission.',
    ],
    note: 'Captured data is for training purposes only; clarify admissibility internally beforehand.',
  },
  'landing-pages': {
    intro:
      'Landing pages are the pages recipients land on after a click. They can optionally capture input to create awareness moments.',
    steps: [
      'Give it a name and design the page’s HTML content (e.g. a cloned login page).',
      'If needed, enable “data capture” to record submitted form data.',
      'Only capture passwords if truly necessary — mind data protection and internal policies.',
      'Optionally add an awareness/redirect page after submission.',
    ],
    note: 'Captured data is for training purposes only; clarify admissibility internally beforehand.',
  },
  'campaign-editor': {
    intro:
      'A campaign bundles template, sender, landing page and recipient groups. Delivery is then started separately via “Send”.',
    steps: [
      'Give it a name and select the email template (required) — it must be created under “Templates” first.',
      'Choose a sending profile for the sender identity; without a selection the global fallback SMTP is used.',
      'Optionally add a landing page recipients land on after clicking.',
      'Select one or more recipient groups (create or import them under “Groups”).',
      'Optionally set a date and time for a scheduled start.',
      'Create the campaign and then start it from the overview via “Send” — afterwards evaluate the results.',
    ],
    note: 'When in doubt, start with a small test group.',
  },
  campaigns: {
    intro:
      'In a campaign you combine template, sending profile, landing page and recipient group and start delivery.',
    steps: [
      'First make sure template, group and (optionally) landing page are created.',
      'Create a new campaign and select the building blocks in the wizard.',
      'Set the sender via a sending profile — otherwise the global fallback SMTP is used.',
      'Save the campaign and then start delivery via “Send”.',
      'After sending, evaluate the results (opens, clicks, input).',
    ],
    note: 'When in doubt, start with a small test group.',
  },
  results: {
    intro:
      'The results show per recipient how they reacted to the campaign — from delivery through open to click and input.',
    steps: [
      'The metrics at the top give an overview of the whole campaign.',
      'In the table, follow each recipient’s status.',
      'Use “Export as CSV” to download the raw data for reports.',
    ],
    note: 'Use the results for targeted awareness measures, not to penalize individuals.',
  },
  users: {
    intro:
      'Here you manage the local accounts for accessing HumanShield.APP. The local login is the primary sign-in method.',
    steps: [
      'Open “New user” and set email, name, initial password and role.',
      'Choose the role: “Admin” may manage settings and users, “User” only campaign features.',
      'If needed, deactivate accounts instead of deleting them to temporarily block access.',
    ],
    note: 'With OIDC active, users must still exist as local accounts with a matching email.',
  },
  profile: {
    intro: 'Here you change your displayed name and your password.',
    steps: [
      'Adjust the name and save.',
      'To change the password, enter the current password and the new one twice.',
      'Use a strong, unique password.',
    ],
    note: 'Your email address and role can only be changed by an admin.',
  },
  'settings-ldap': {
    intro:
      'Via LDAP you import email recipients directly from your directory service (e.g. Active Directory or OpenLDAP) into groups.',
    steps: [
      'Enter host and port of the LDAP server (default: 389, LDAPS: 636).',
      'Choose encryption: LDAPS (SSL) or StartTLS — recommended for production.',
      'Provide the bind DN of a service account with read access, e.g. cn=svc,ou=service,dc=example,dc=com.',
      'Enter the bind password — it is stored encrypted and never shown again.',
      'Set the base DN below which users are searched, e.g. ou=users,dc=example,dc=com.',
      'If needed, adjust the user filter and attribute mapping (AD: email usually “mail”, first name “givenName”, last name “sn”).',
      'Click “Test connection” — it saves the values and checks connection and login.',
    ],
    note: 'The import itself then happens under Groups → “LDAP import”.',
  },
  'settings-oidc': {
    intro:
      'OIDC is an optional second sign-in via single sign-on. The local login remains the primary method — the app runs fully without OIDC.',
    steps: [
      'In your identity provider (Authentik, Keycloak, Entra ID, Okta, …) create a new OIDC application.',
      'Set the callback address as redirect URI: https://<your-domain>/api/auth/callback.',
      'Copy the issuer URL from the IdP (base URL of the OIDC discovery).',
      'Enter client ID and client secret — the secret is stored encrypted.',
      'Save and then toggle “Enable OIDC”: the SSO button appears on the sign-in page.',
    ],
    note: 'Users must exist as local accounts with a matching email so the SSO sign-in can be matched.',
  },
  'settings-smtp': {
    intro:
      'The global fallback SMTP is only used when a campaign has no dedicated sending profile. For custom sender identities, better create a sending profile.',
    steps: [
      'Enter host and port of your SMTP provider (works with any provider: IONOS, Hetzner, Mailgun, your own server, …).',
      'Choose the TLS mode matching the port: STARTTLS for port 587, SSL/TLS for port 465, unencrypted only for port 25 on an internal network.',
      'Enter the mailbox’s username and password — the password is stored encrypted.',
      'Set the sender address and name; the address must be authorized to send at the provider (mind SPF/DKIM).',
      'Click “Test connection” — it saves the values and checks connection and login.',
    ],
    note: 'On a fresh installation this page is pre-filled with the SMTP values from .env.',
  },
  recurring: {
    intro:
      'Recurring campaigns automatically send a new iteration to the same groups at a fixed interval — ideal for continuous awareness.',
    steps: [
      'Pick template, sending profile and landing page like for a normal campaign.',
      'Assign recipient groups — on each due date fresh recipients with new tracking tokens are generated from them.',
      'Set the interval in days (e.g. 30) and enable the automation.',
      'Results per iteration appear under the campaign results, like for single campaigns.',
    ],
    note: 'Business feature. The scheduler triggers due dates server-side — nobody needs to be logged in.',
  },
  multistage: {
    intro:
      'Multi-stage campaigns send a sequence of templates to the same recipients, each with a time delay — e.g. lure, then reminder.',
    steps: [
      'Set name, groups, sending profile and landing page.',
      'Add stages: each stage has a template and a delay in days from campaign start.',
      'Review the order and gaps, then start the campaign.',
      'Progress (stages sent) is counted per campaign.',
    ],
    note: 'Business feature. Stages become due automatically — no manual follow-up needed.',
  },
  'auto-campaigns': {
    intro:
      'Automatic, risk-based campaigns dynamically pick recipients by risk and send at a fixed interval — targeting those who need it most.',
    steps: [
      'Pick template, sending profile and landing page.',
      'Choose the risk target: “submitted data”, “clicked” or “all” — this determines the recipients.',
      'Set the interval in days and enable it.',
      'On each due date the system re-selects the matching recipients and sends automatically.',
    ],
    note: 'Enterprise feature. Builds on the recipients’ human risk score.',
  },
  reports: {
    intro:
      'Reports bundle metrics, risk and evidence. The top part is Open Core; user development, department comparison and PDF evidence are Business, training progress and AI risk analysis are Enterprise.',
    steps: [
      'The management report at the top gives the overall picture (metrics, campaign comparison, risk distribution) — exportable as CSV/PDF.',
      'User development and department comparison show where risk is concentrated.',
      'AI risk analysis creates an assessment with prioritized actions on demand (requires a configured AI integration).',
      'Under “Evidence & certificates” you download compliance documents (GDPR, NIS2, ISO 27001 …) as PDF.',
    ],
    note: 'Locked sections only fill with data once the matching license is active.',
  },
  integrations: {
    intro:
      'The integrations area bundles connections to external systems (SIEM, directories, SSO) and the license-dependent add-on features.',
    steps: [
      'Pick the desired area in the left column (like the settings menu).',
      'Business/Enterprise integrations are marked with a license badge and locked without a valid license.',
      'The actual configuration (e.g. LDAP, SIEM, SAML) happens on the respective settings pages.',
    ],
    note: 'New integrations appear here automatically once unlocked by a license.',
  },
  'settings-entra': {
    intro:
      'Via Azure AD / Entra ID you import recipients directly from the Microsoft directory (Graph API, app registration with client credentials).',
    steps: [
      'Create an app registration in Entra and grant permission to read users/groups.',
      'Enter tenant ID, client ID and client secret here — the secret is stored encrypted.',
      'Enable the integration, then import a group under “Groups → Entra import”.',
    ],
    note: 'Business feature. The client secret is never returned via the API (only a has_* flag).',
  },
  'settings-webhooks': {
    intro:
      'Webhooks send a JSON POST to one or more URLs on every tracking event (open, click, submit) — e.g. for ticketing or your own automations.',
    steps: [
      'Enter the receiving system’s target URL and enable the webhook.',
      'Optionally add multiple URLs — each event is delivered to all active webhooks.',
      'Process the incoming JSON payloads on the receiver (event type, recipient, campaign, time).',
    ],
    note: 'Business feature. Delivery is asynchronous and does not block tracking.',
  },
  'settings-whitelabel': {
    intro:
      'White-label adapts the look to your company: app name, accent colors and logo — app-wide including the login page.',
    steps: [
      'Set the app name (shown in header and title).',
      'Choose the primary and gradient accent color to match your corporate design.',
      'Optionally upload a logo (stored as a data URI).',
      'Save — changes apply immediately; the login page after the next logout.',
    ],
    note: 'Enterprise feature.',
  },
  'settings-siem': {
    intro:
      'The SIEM export forwards every tracking event to a SIEM: Splunk HEC, Elasticsearch, Microsoft Sentinel or generic JSON.',
    steps: [
      'Choose the target SIEM’s format.',
      'Enter the endpoint URL and token/API key — the token is stored encrypted.',
      'Optionally specify an index/source (e.g. Splunk index).',
      'Send a test event with “Test connection”, then enable it.',
    ],
    note: 'Enterprise feature. Delivery is asynchronous per event.',
  },
  'settings-saml': {
    intro:
      'SAML single sign-on allows login via a SAML 2.0 identity provider (ADFS, Entra ID, Keycloak, Okta …) as an optional second method.',
    steps: [
      'Create an application at the IdP; import this app’s SP metadata (button “SP metadata”) there.',
      'Enter the IdP entity ID, SSO URL and signing certificate here; set the SP entity ID and ACS URL.',
      'Optionally fill the attribute mapping for email/display name (empty = NameID as email).',
      'Enable it — a SAML SSO button then appears on the login page.',
    ],
    note: 'Enterprise feature. The assertion must be signed; signature, validity and audience are checked.',
  },
  'settings-ai': {
    intro:
      'The AI integration is provider-neutral: it talks to an OpenAI-compatible API and powers AI creation of templates/landing pages and AI scoring.',
    steps: [
      'Choose any provider (OpenAI, Azure OpenAI, Anthropic-compatible, Mistral, Groq, OpenRouter or local via Ollama/vLLM/LM Studio).',
      'Enter the base URL (…/v1), model and API key — the key is stored encrypted.',
      'Verify with “Test connection” and enable it.',
      'Afterwards “Create with AI” appears in the editors and the AI risk analysis becomes usable.',
    ],
    note: 'Business feature. No provider is ever hard-wired in the code.',
  },
  'settings-security': {
    intro:
      'Here you set the security-relevant policies — such as enforcing two-factor authentication.',
    steps: [
      'Set policies as needed (e.g. mandatory 2FA).',
      'Save changes — they apply from the next login.',
      'You set up your own 2FA method under “My profile”.',
    ],
    note: 'Changes to security policies are recorded in the audit log.',
  },
  'settings-license': {
    intro:
      'The license unlocks the Business and Enterprise features. Without a license the Open Core version runs fully.',
    steps: [
      'Enter and activate a license key — the status (customer, expiry, features) is shown.',
      'Unlocked features then appear without the lock icon.',
      'The status is refreshed automatically at regular intervals.',
    ],
    note: 'Without a license key the Business/Enterprise areas stay visible but locked.',
  },
  'settings-audit': {
    intro:
      'The audit log records login events (success/failure/blocked) and system changes (users, settings, 2FA) with timestamp and IP.',
    steps: [
      'The list shows the most recent events first.',
      'After login problems, look here for failed/blocked logins.',
      'Changes to settings and accounts are documented here for traceability.',
    ],
    note: 'The audit log also serves as evidence for compliance requirements.',
  },
}

export const pageGuidance: Record<Lang, Record<string, Guidance>> = { de, en }
