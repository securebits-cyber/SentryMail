# Datenschutz-Kurzdarstellung: Phishing-Awareness-Simulationen

> Diese Kurzdarstellung erklärt in verständlicher Form, welche Daten bei
> Phishing-Simulationen mit **SentryMail** verarbeitet werden und wozu. Sie ist als Grundlage
> für die Information der Beschäftigten nach Art. 13 DSGVO und für die Abstimmung mit der
> Interessenvertretung gedacht — sie ersetzt weder die Datenschutzerklärung des Betreibers
> noch eine rechtliche Prüfung. Platzhalter in `[eckigen Klammern]` sind auszufüllen.

## Worum geht es?

Ihr Arbeitgeber versendet gelegentlich E-Mails, die wie Phishing-Angriffe aussehen, aber
keine sind. Sie stammen aus einem Testsystem und richten keinen Schaden an. Ziel ist
herauszufinden, wie gut die Organisation als Ganzes solche Angriffe erkennt, und die
Schulungen dort anzusetzen, wo sie wirken.

**Es geht nicht darum, einzelne Personen zu bewerten.** Die Software ist technisch so
eingestellt, dass Auswertungen über einzelne Personen gar nicht erst ausgegeben werden.

## Wer ist verantwortlich?

| | |
|---|---|
| Verantwortlicher | [Unternehmen, Anschrift] |
| Datenschutzbeauftragter | [Name, E-Mail, Telefon] |
| Betriebs-/Personalrat | [Kontakt] |

Die Software läuft **auf Systemen des Verantwortlichen** ([Standort]). Es werden keine Daten
an den Hersteller oder an sonstige Dritte übermittelt; es gibt keine Cloud-Anbindung.

## Welche Daten werden verarbeitet?

**Zur Zustellung:** E-Mail-Adresse, Vor- und Nachname, sowie Abteilung, Funktion und eine
Einstufung der Kritikalität als Momentaufnahme zum Zeitpunkt der Kampagne.

**Zur Messung:** ob und wann eine Nachricht zugestellt und geöffnet wurde, ob ein Link
geklickt und ob ein Formular abgeschickt wurde — jeweils mit Zeitstempel.

**Technische Merkmale des Zugriffs:** IP-Adresse, Browser, Betriebssystem und Gerätetyp,
Referrer, Spracheinstellung und Bildschirmauflösung. Ein Länderkennzeichen wird nur ermittelt,
wenn eine lokale GeoIP-Datenbank hinterlegt ist — und ausschließlich auf Länderebene, nie
genauer.

**Nicht verarbeitet werden:** Inhalte Ihrer echten E-Mails, Ihr Surfverhalten außerhalb der
Simulationsseiten, die Nutzung anderer Anwendungen, Tastatureingaben oder Bildschirminhalte.

**Client-Fingerprinting** (ein technischer Wiedererkennungswert des Browsers) ist
standardmäßig **abgeschaltet**. [Aktueller Stand in dieser Instanz: [aus / eingeschaltet].]
Ist es eingeschaltet, ist der Wert dennoch niemals Bestandteil personenbezogener Berichte.

**Formulareingaben:** Fordert eine Simulationsseite zur Eingabe von Zugangsdaten auf, werden
passwortartige Felder bereits **vor** dem Speichern maskiert. Ein Klartext-Passwort wird zu
keinem Zeitpunkt gespeichert. [Aktueller Stand: [nicht im Einsatz / im Einsatz].]

## Wozu und auf welcher Rechtsgrundlage?

| Zweck | Rechtsgrundlage |
|---|---|
| Aufbau und Prüfung des Sicherheitsbewusstseins, Schutz vor Angriffen | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an IT-Sicherheit), Art. 32 DSGVO |
| Nachweis durchgeführter Awareness-Maßnahmen | Art. 6 Abs. 1 lit. c DSGVO i. V. m. [NIS2-Umsetzung / § 8a BSIG / vertraglichen Pflichten] |
| Durchführung im Beschäftigungsverhältnis | § 26 Abs. 1 BDSG, [Betriebsvereinbarung vom [Datum] als Kollektivvereinbarung i. S. v. Art. 88 DSGVO] |

## Wie wird Ihr Personenbezug geschützt?

Der **Datenschutz- und Mitbestimmungsmodus** der Software ist aktiviert. Er bewirkt:

- **Auswertungen einzelner Personen sind gesperrt.** Die Anwendung verweigert sie
  serverseitig — auch gegenüber Administratoren. Betroffen sind Empfängerlisten,
  Sitzungsverläufe, CSV-Exporte und namentliche Ranglisten.
- **Gruppenauswertungen erst ab [5] Personen.** Kleinere Gruppen werden nicht ausgegeben,
  sondern ausdrücklich als „unter Schwellenwert" gekennzeichnet.
- **Aufhebung nur im Vier-Augen-Verfahren.** In begründeten Einzelfällen kann ein Administrator
  eine befristete Freigabe beantragen; entscheiden darf **ausschließlich der
  Datenschutzbeauftragte**, niemals die antragstellende Person selbst. Jede Freigabe ist auf
  [24] Stunden befristet, gilt nur für die antragstellende Person und wird protokolliert.
- **Getrennte Rollen.** Wer auswertet, gibt nicht frei; wer freigibt, wertet nicht aus.
- **Protokollierung.** Anträge, Freigaben, Ablehnungen und Widerrufe werden mitsamt Begründung
  festgehalten und sind für den Datenschutzbeauftragten einsehbar.

## Wie lange werden die Daten gespeichert?

Die Aufbewahrungsfrist beträgt **[180] Tage** ab Beginn einer Kampagne. Danach anonymisiert
die Software abgeschlossene Kampagnen automatisch und **unwiderruflich**: E-Mail-Adresse und
Name sowie IP-Adresse, Fingerabdruck, Referrer, User-Agent, Bildschirmauflösung und
Spracheinstellung werden entfernt.

Erhalten bleiben nur noch anonyme Kennzahlen. Danach lässt sich belegen, **wie viele** Personen
reagiert haben — aber nicht mehr, **wer**.

## Welche Folgen hat es, wenn ich auf eine Simulation hereinfalle?

Keine nachteiligen. Sie erhalten Hinweise oder ein Schulungsangebot. Die Ergebnisse werden
nicht zur Leistungsbewertung, nicht für personelle Einzelmaßnahmen und nicht als Grundlage
arbeitsrechtlicher Sanktionen verwendet. **Automatische technische Sanktionen wie
Kontosperrungen finden nicht statt.**

Wird das Schulungsmodul eingesetzt, kann eine Schulung bei erhöhtem Risikowert automatisch
zugewiesen werden. Diese Zuweisung erfolgt maschinell; die auslösenden Einzelwerte werden
dabei niemandem angezeigt. Eine Fristüberschreitung führt nur zu einer organisatorischen
Erinnerung.

## Wird meine Mailbox durchsucht?

Nur im Ausnahmefall und nur gezielt. Meldet jemand eine Phishing-Mail und wird diese als
Angriff bestätigt, kann [Verantwortliche Stelle / Rolle] die Software anweisen, **genau diese
eine Nachricht** in allen Postfächern zu suchen und in einen Quarantäne-Ordner zu verschieben.

- Gesucht wird ausschließlich über die technische Kennung dieser Nachricht (Message-ID) —
  nicht nach Betreff, Inhalt oder Absender, und niemals nach anderen Nachrichten.
- Es wird **nur verschoben, nie gelöscht**. Die Nachricht bleibt in Ihrem Postfach und lässt
  sich zurückholen.
- Niemand liest dabei Ihre Post. Zurückgemeldet wird nur, in wie vielen Postfächern die
  Nachricht lag.
- Jeder Vorgang wird protokolliert und der Interessenvertretung berichtet.

## Ihre Rechte

Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und **Widerspruch
gegen die Verarbeitung (Art. 21 DSGVO)**. Außerdem können Sie sich bei der zuständigen
Aufsichtsbehörde beschweren ([Behörde, Anschrift]).

Wenden Sie sich dazu an [Datenschutzbeauftragter, Kontakt].

Ein Hinweis zur Auskunft: Nach der Anonymisierung sind die Daten keiner Person mehr
zuzuordnen. Der Verantwortliche kann sie dann auch auf Anfrage nicht mehr herstellen — das ist
kein Versäumnis, sondern der Zweck der Löschregel.

---

*Stand: [Datum] · Zugehörige Unterlagen: [Betriebsvereinbarung vom [Datum]],
Verarbeitungsverzeichnis Nr. [Nummer].*
