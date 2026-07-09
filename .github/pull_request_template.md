<!--
  DE: Titel bitte als Conventional Commit formulieren (release-please wertet dies aus):
  EN: Please write the title as a Conventional Commit (evaluated by release-please):
      feat(scope): …  |  fix(scope): …  |  docs: …  |  refactor: …  |  chore: …
      DE: Breaking Change: "!" anhängen · EN: Breaking change: append "!"  →  feat(api)!: …
-->

## Beschreibung / Description

<!--
  DE: Was ändert dieser PR und warum? Kurz und konkret.
  EN: What does this PR change and why? Short and concrete.
-->

## Art der Änderung / Type of change

<!--
  DE: Zutreffendes ankreuzen (x). Bestimmt den Release-Typ (release-please).
  EN: Check what applies (x). Determines the release type (release-please).
-->

- [ ] `feat` – DE: neue Funktion · EN: new feature
- [ ] `fix` – DE: Fehlerbehebung · EN: bug fix
- [ ] `refactor` – DE: Umbau ohne Verhaltensänderung · EN: change without behavior change
- [ ] `docs` – DE: nur Dokumentation · EN: documentation only
- [ ] `chore` / `ci` / `build` – DE: Wartung, Tooling, Abhängigkeiten · EN: maintenance, tooling, dependencies
- [ ] `security` – DE: sicherheitsrelevante Änderung · EN: security-relevant change
- [ ] **Breaking Change** – DE: bitte unten unter „Hinweise" beschreiben · EN: describe under "Notes" below

## Zusammenhängende Issues / Related issues

<!-- z. B. / e.g.  Closes #123 -->

## Wie getestet? / How was it tested?

<!--
  DE: Betroffene Bereiche und Prüfschritte beschreiben.
  EN: Describe affected areas and verification steps.
-->

- [ ] `tsc --noEmit` – DE: Frontend-Typecheck ohne Fehler · EN: frontend type-check passes
- [ ] `npm run build` – DE: bzw. Docker-Build erfolgreich · EN: or Docker build succeeds
- [ ] DE: Backend-Tests / manuelle Prüfung der betroffenen Flows · EN: backend tests / manual check of affected flows
- [ ] DE: In der laufenden App (Docker-Compose) verifiziert · EN: verified in the running app (Docker Compose)

## Screenshots

<!--
  DE: Bei UI-Änderungen: vorher/nachher, Light- und Dark-Mode.
  EN: For UI changes: before/after, light and dark mode.
-->

## Checkliste / Checklist

- [ ] DE: PR-Titel folgt Conventional Commits · EN: PR title follows Conventional Commits
- [ ] DE: Keine Secrets / Zugangsdaten / echten Kundendaten im Diff · EN: no secrets / credentials / real customer data in the diff
- [ ] DE: i18n gepflegt – neue Texte in **DE und EN** ergänzt · EN: i18n updated – new strings added in **DE and EN**
- [ ] DE: DB-Migrationen enthalten (falls Schemaänderung) · EN: DB migrations included (if schema changed)
- [ ] DE: README / Doku aktualisiert (falls nötig) · EN: README / docs updated (if needed)
- [ ] DE: Breaking Changes dokumentiert (falls vorhanden) · EN: breaking changes documented (if any)

## Hinweise / Notes

<!--
  DE: Migrationsschritte, Konfigurations-/`.env`-Änderungen, Breaking-Change-Details, offene Punkte.
  EN: Migration steps, config/`.env` changes, breaking-change details, open items.
-->
