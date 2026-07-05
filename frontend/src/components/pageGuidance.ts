// Zentrale Anleitungstexte fuer den Hilfe-Bereich rechts (PageScaffold).
// Key = guidanceKey der jeweiligen Seite. Neue Seite -> hier ergaenzen.

export interface Guidance {
  intro: string
  steps: string[]
  note?: string
  variables?: { name: string; desc: string }[]
}

export const pageGuidance: Record<string, Guidance> = {
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
}
