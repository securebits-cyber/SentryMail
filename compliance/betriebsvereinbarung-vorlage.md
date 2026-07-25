# Muster-Betriebsvereinbarung: Phishing-Awareness-Simulationen mit SentryMail

> **Diese Vorlage ist kein Rechtsrat.** Sie beschreibt, was SentryMail technisch tut, und
> gibt dem Betriebs- oder Personalrat und der Arbeitgeberseite eine gemeinsame
> Verhandlungsgrundlage. Jede Formulierung ist an die Verhältnisse im Betrieb anzupassen
> und vor Abschluss arbeitsrechtlich zu prüfen. Platzhalter in `[eckigen Klammern]`
> müssen ausgefüllt werden.

Zwischen

**[Name des Unternehmens]**, vertreten durch [Name, Funktion] — nachfolgend „Arbeitgeber" —

und

dem **[Betriebsrat / Personalrat]** des [Betrieb / Dienststelle], vertreten durch [Name] —
nachfolgend „Interessenvertretung" —

wird folgende Vereinbarung geschlossen.

---

## § 1 Gegenstand und Zweck

(1) Diese Vereinbarung regelt Einsatz und Grenzen der Software **SentryMail** zur Durchführung
simulierter Phishing-Angriffe und begleitender Awareness-Maßnahmen.

(2) Zweck ist ausschließlich, das Sicherheitsbewusstsein der Beschäftigten zu messen und zu
verbessern sowie den Nachweis durchgeführter Schulungs- und Sensibilisierungsmaßnahmen zu
führen (u. a. Art. 32 DSGVO, NIS2 Art. 21 Abs. 2 lit. g, BSI IT-Grundschutz ORP.3,
ISO/IEC 27001 A.6.3).

(3) **Eine Leistungs- oder Verhaltenskontrolle einzelner Beschäftigter ist ausgeschlossen.**
Die Ergebnisse werden nicht zur Bewertung der Arbeitsleistung, nicht für personelle
Einzelmaßnahmen und nicht als Grundlage arbeitsrechtlicher Sanktionen verwendet.

## § 2 Geltungsbereich

Diese Vereinbarung gilt für alle Beschäftigten des [Betriebs/der Dienststelle] im Sinne von
§ 5 BetrVG [bzw. § 4 BPersVG] sowie für [Leiharbeitnehmer / Auszubildende / …].

## § 3 Betriebsmodus der Software

(1) SentryMail wird ausschließlich auf Systemen unter der Kontrolle des Arbeitgebers
betrieben ([Standort / Rechenzentrum]). Eine Übermittlung der Daten an den Hersteller oder
an Dritte findet nicht statt.

(2) Der **Datenschutz- und Mitbestimmungsmodus** der Software ist dauerhaft aktiviert. Er
bewirkt technisch:

a) **Sperre für Einzelpersonen-Auswertungen.** Auswertungen, die einzelne Beschäftigte
   benennen, werden von der Anwendung verweigert — nicht ausgeblendet, sondern serverseitig
   abgelehnt. Das betrifft insbesondere Empfängerlisten, Sitzungsverläufe, CSV-Exporte,
   namentliche Risikoranglisten und die Liste der „durchgefallenen" Personen.

b) **k-Anonymität.** Gruppenauswertungen (z. B. nach Abteilung, Land, Browser oder Kampagne)
   werden nur ausgegeben, wenn mindestens **k = [5]** Personen beteiligt sind. Kleinere
   Gruppen werden ausdrücklich als „unter Schwellenwert" gekennzeichnet, damit die Lücke
   erkennbar bleibt. Gezählt werden Personen, nicht Ereignisse.

c) **Kein Client-Fingerprinting.** Die Erfassung eines technischen Browser-Fingerabdrucks
   bleibt deaktiviert. [Alternativ: Sie wird mit Zustimmung der Interessenvertretung
   aktiviert; der Fingerabdruck ist auch dann nie Bestandteil personenbezogener Berichte.]

(3) Änderungen an diesen Einstellungen werden protokolliert (§ 7) und sind der
Interessenvertretung unverzüglich mitzuteilen.

## § 4 Verarbeitete Daten

(1) Verarbeitet werden je Simulationsteilnahme:

| Datenart | Zweck |
|---|---|
| E-Mail-Adresse, Vor- und Nachname | Versand der Simulationsnachricht |
| Abteilung, Funktion, Kritikalität (Momentaufnahme) | Gruppenauswertung nach § 3 Abs. 2 lit. b |
| Zeitpunkt von Versand, Öffnen, Klick, Formularabsendung | Wirksamkeitsmessung |
| IP-Adresse | technische Zustellung, Missbrauchserkennung |
| Browser, Betriebssystem, Gerätetyp (aus dem User-Agent abgeleitet) | Auswertung der Angriffsfläche |
| Länderkennzeichen (nur bei lokal hinterlegter GeoIP-Datenbank) | Auswertung, ausschließlich auf Länderebene |
| Referrer, Spracheinstellung, Bildschirmauflösung | Auswertung der Angriffsfläche |

(2) **Keine Erfassung von Inhalten.** Der Inhalt tatsächlicher E-Mails, das Surfverhalten
außerhalb der Simulationsseiten und die Nutzung sonstiger Anwendungen werden nicht erfasst.

(3) **Passwortabfrage.** Sofern eine Simulationsseite Eingabefelder enthält, werden
passwortartige Felder **vor** dem Speichern maskiert; ein Klartext-Passwort wird zu keinem
Zeitpunkt gespeichert. Die maskierten Eingaben werden zusätzlich verschlüsselt abgelegt und
unterliegen der Sperre nach § 3 Abs. 2 lit. a.
[Alternativ: Die Passwortabfrage wird nicht eingesetzt.]

## § 5 Rollen und Zugriffsrechte

(1) Die Software trennt technisch drei Rollen:

- **Administrator** — richtet Kampagnen ein und wertet aggregiert aus. Er hat **keinen**
  Zugriff auf Einzelpersonen-Auswertungen, solange keine Freigabe nach § 6 vorliegt.
- **Datenschutzbeauftragter** — entscheidet über Freigaben nach § 6 und liest das
  Protokoll nach § 7. Er wertet selbst nicht aus und ändert die Konfiguration nicht.
- **Benutzer** — ohne administrative Rechte.

(2) Die Rolle des Datenschutzbeauftragten wird besetzt mit [Name/Funktion]. Die
Interessenvertretung erhält [Lesezugriff auf das Protokoll nach § 7 / eine eigene Kennung
mit dieser Rolle].

## § 6 Aufhebung der Sperre im Vier-Augen-Verfahren

(1) In begründeten Einzelfällen — insbesondere bei Verdacht auf einen tatsächlichen Angriff
oder zur Bearbeitung eines Sicherheitsvorfalls — kann die Sperre nach § 3 Abs. 2 lit. a
befristet aufgehoben werden.

(2) Das Verfahren ist technisch erzwungen:

a) Ein Administrator stellt einen Antrag und muss dabei eine **Begründung** angeben.

b) Über den Antrag entscheidet **ausschließlich der Datenschutzbeauftragte**. Ein Antrag
   kann von der antragstellenden Person **nicht selbst** freigegeben werden; die Software
   verhindert das auf Anwendungs- **und** Datenbankebene.

c) Die Freigabe gilt nur für die antragstellende Person, längstens für **[24] Stunden** und
   wahlweise nur für **eine einzelne Kampagne**. Nach Ablauf greift die Sperre automatisch
   wieder.

d) Freigaben können jederzeit vorzeitig widerrufen werden.

(3) Die Interessenvertretung wird über jede erteilte Freigabe [unverzüglich / im Rahmen der
Quartalsberichte nach § 9] unterrichtet.

## § 7 Protokollierung

(1) Die Software protokolliert unveränderbar: Anträge, Freigaben, Ablehnungen und Widerrufe
nach § 6 jeweils mit Begründung, Änderungen der Datenschutzeinstellungen, Änderungen an
Benutzerkonten und Rollen sowie die Läufe der automatischen Löschung nach § 8.

(2) Das Protokoll ist für Administratoren und den Datenschutzbeauftragten einsehbar. Es dient
ausschließlich der Kontrolle dieser Vereinbarung und nicht der Verhaltenskontrolle.

## § 8 Aufbewahrung und Löschung

(1) Die Aufbewahrungsfrist beträgt **[180] Tage** ab Beginn einer Kampagne.

(2) Nach Ablauf anonymisiert die Software abgeschlossene Kampagnen automatisch und
unwiderruflich: E-Mail-Adresse und Name der Empfänger sowie IP-Adresse, Fingerabdruck,
Referrer, User-Agent, Bildschirmauflösung und Spracheinstellung der Ereignisse werden
entfernt.

(3) Erhalten bleiben ausschließlich anonyme Kennzahlen (etwa: wie viele Personen geklickt
haben, mit welchem Browser, in welchem Land). Es bleibt damit nachweisbar, **wie viele**
Beschäftigte reagiert haben, nicht **wer**.

(4) Der Lauf erfolgt automatisch; Zeitpunkt und Umfang jedes Laufs werden nach § 7
protokolliert.

## § 9 Information der Beschäftigten und der Interessenvertretung

(1) Vor der ersten Simulation werden die Beschäftigten allgemein darüber informiert, dass
Phishing-Simulationen durchgeführt werden, zu welchem Zweck und nach welchen Regeln. Der
konkrete Zeitpunkt einzelner Simulationen wird nicht angekündigt — sonst wäre die Messung
wertlos.

(2) Die Interessenvertretung erhält [quartalsweise] einen Bericht mit den aggregierten
Ergebnissen sowie einer Übersicht der Freigaben nach § 6.

(3) Beschäftigte, die auf eine Simulation hereingefallen sind, erhalten ausschließlich
unterstützende Hinweise oder Schulungsangebote. **Automatische technische Sanktionen —
insbesondere Kontosperrungen — finden nicht statt.**

## § 10 Schulungszuweisung *(nur bei Einsatz des Schulungsmoduls)*

(1) Das Schulungsmodul kann Schulungen automatisch zuweisen, wenn ein individueller
Risikowert eine Schwelle überschreitet. Dies ist eine Verhaltenskontrolle im Sinne von
§ 87 Abs. 1 Nr. 6 BetrVG und wird hiermit ausdrücklich vereinbart.

(2) Die Zuweisung erfolgt maschinell; die zugrunde liegenden Einzelwerte werden dabei
niemandem angezeigt. Der Abschlussstatus einer Schulung ist für die Schulungsverwaltung
sichtbar, die auslösenden Einzelwerte nicht.

(3) Eine Fristüberschreitung führt ausschließlich zu einer organisatorischen Erinnerung,
nicht zu einer technischen Sperre.

## § 11 Massen-Quarantäne *(nur bei Einsatz der Quarantäne-Funktion)*

(1) Wird eine gemeldete Phishing-Mail als Angriff bestätigt, kann die Software sie in allen
Postfächern des Mailsystems suchen und in einen Quarantäne-Ordner verschieben. Gesucht wird
ausschließlich anhand der Message-ID der gemeldeten Nachricht; eine Suche nach Betreff,
Inhalt oder Absender findet nicht statt.

(2) Nachrichten werden ausschließlich **verschoben, niemals gelöscht**. Sie verbleiben im
Postfach der betroffenen Person und können von dort zurückgeholt werden.

(3) Auslösen dürfen ausschließlich [Rolle/Personenkreis]. Jeder Ausführung geht zwingend ein
Probelauf voraus, der nichts verändert und dessen Ergebnis gespeichert wird; ohne diesen
Probelauf ist eine Ausführung technisch ausgeschlossen.

(4) Probelauf und Ausführung werden mit Zeitpunkt, auslösender Person, Betreff und Anzahl der
betroffenen Nachrichten protokolliert. Die Interessenvertretung erhält [monatlich /
quartalsweise] eine Übersicht der durchgeführten Läufe.

(5) Der Zugriff dient ausschließlich der Abwehr eines konkreten Angriffs. Eine Durchsicht von
Postfächern zu anderen Zwecken ist ausgeschlossen; die Software bietet dafür keine Funktion.

## § 12 Rechte der Beschäftigten

Die Rechte nach Art. 15 bis 21 DSGVO bleiben unberührt. Anfragen richten Beschäftigte an
[Datenschutzbeauftragter, Kontakt]. Nach der Anonymisierung gemäß § 8 ist eine Zuordnung zu
einer Person nicht mehr möglich; ein Auskunftsanspruch geht insoweit ins Leere.

## § 13 Schlussbestimmungen

(1) Diese Vereinbarung tritt am [Datum] in Kraft.

(2) Sie kann mit einer Frist von [drei Monaten] zum Monatsende gekündigt werden. Bis zum
Abschluss einer neuen Vereinbarung wirkt sie nach.

(3) Bei wesentlichen Änderungen der Software — insbesondere neuen Auswertungsmöglichkeiten
mit Personenbezug — nehmen die Parteien unverzüglich Verhandlungen auf. Bis zu einer Einigung
bleiben die neuen Funktionen deaktiviert.

(4) Sollte eine Bestimmung unwirksam sein, bleibt die Vereinbarung im Übrigen wirksam.

<br>

[Ort], den [Datum]

<br>

________________________  ________________________
Für den Arbeitgeber   Für die Interessenvertretung
