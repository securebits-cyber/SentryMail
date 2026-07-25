# Privacy overview: phishing awareness simulations

> This overview explains in plain terms which data is processed during phishing simulations
> with **SentryMail** and why. It is intended as a basis for informing employees under
> Art. 13 GDPR and for coordination with the employee representation — it replaces neither the
> operator's own privacy notice nor a legal review. Placeholders in `[square brackets]` must be
> filled in.
>
> The German version (`datenschutz-kurzdarstellung.md`) is the authoritative one for German
> workplaces; this translation is provided for international teams.

## What is this about?

Your employer occasionally sends emails that look like phishing attacks but are not. They come
from a test system and cause no harm. The goal is to find out how well the organisation as a
whole recognises such attacks, and to direct training where it has an effect.

**This is not about assessing individuals.** The software is configured so that evaluations of
individual people are not produced in the first place.

## Who is responsible?

| | |
|---|---|
| Controller | [Company, address] |
| Data protection officer | [Name, email, phone] |
| Works/staff council | [Contact] |

The software runs **on the controller's own systems** ([location]). No data is transmitted to
the vendor or to any third party; there is no cloud connection.

## Which data is processed?

**For delivery:** email address, first and last name, plus department, position and a
criticality rating as a point-in-time snapshot taken when the campaign was built.

**For measurement:** whether and when a message was delivered and opened, whether a link was
clicked and whether a form was submitted — each with a timestamp.

**Technical characteristics of the access:** IP address, browser, operating system and device
type, referrer, language setting and screen resolution. A country code is only determined if a
local GeoIP database is installed — and only at country level, never more precisely.

**Not processed:** the content of your genuine emails, your browsing behaviour outside the
simulation pages, your use of other applications, keystrokes or screen contents.

**Client fingerprinting** (a technical browser recognition value) is **disabled** by default.
[Current state in this instance: [off / on].] Even when enabled, the value is never part of
person-identifiable reports.

**Form entries:** if a simulation page asks for credentials, password-like fields are masked
**before** they are stored. A plaintext password is never stored at any point.
[Current state: [not in use / in use].]

## For what purpose and on what legal basis?

| Purpose | Legal basis |
|---|---|
| Building and testing security awareness, protection against attacks | Art. 6(1)(f) GDPR (legitimate interest in IT security), Art. 32 GDPR |
| Evidencing that awareness measures were carried out | Art. 6(1)(c) GDPR in conjunction with [NIS2 implementation / § 8a BSIG / contractual duties] |
| Processing in the employment context | § 26(1) BDSG, [works agreement of [date] as a collective agreement under Art. 88 GDPR] |

## How is your personal identifiability protected?

The software's **data protection and co-determination mode** is enabled. It means:

- **Evaluations of individual people are blocked.** The application refuses them server-side —
  including for administrators. This covers recipient lists, session histories, CSV exports and
  named rankings.
- **Group evaluations only from [5] people upward.** Smaller groups are not released but
  explicitly marked as "below threshold".
- **Lifting the lock only under the four-eyes principle.** In justified individual cases an
  administrator can request a time-limited unlock; **only the data protection officer** may
  decide, never the requesting person themselves. Every unlock is limited to [24] hours, applies
  only to the requesting person and is logged.
- **Separated roles.** Whoever evaluates does not approve; whoever approves does not evaluate.
- **Logging.** Requests, approvals, rejections and revocations are recorded together with their
  reasons and can be reviewed by the data protection officer.

## How long is the data kept?

The retention period is **[180] days** from the start of a campaign. After that the software
anonymises completed campaigns automatically and **irreversibly**: email address and name as
well as IP address, fingerprint, referrer, user agent, screen resolution and language setting
are removed.

Only anonymous metrics remain. From that point on it can be shown **how many** people reacted —
but no longer **who**.

## What happens if I fall for a simulation?

Nothing detrimental. You receive guidance or an offer of training. The results are not used to
assess performance, not for individual personnel measures and not as grounds for disciplinary
action. **No automatic technical sanctions such as account lockouts take place.**

Where the training module is used, a course can be assigned automatically if a risk score is
elevated. That assignment is made by the machine; the triggering individual scores are not
displayed to anyone. Missing a deadline results only in an organisational reminder.

## Your rights

You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17),
restriction of processing (Art. 18), data portability (Art. 20) and **to object to the
processing (Art. 21 GDPR)**. You may also lodge a complaint with the competent supervisory
authority ([authority, address]).

To exercise these rights, contact [data protection officer, contact details].

One note on access requests: after anonymisation the data can no longer be attributed to any
person. The controller cannot reconstruct it even on request — that is not an omission but the
very purpose of the deletion rule.

---

*Last updated: [date] · Related documents: [works agreement of [date]], record of processing
activities no. [number].*
