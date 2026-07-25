# Model works agreement: phishing awareness simulations with SentryMail

> **This template is not legal advice.** It describes what SentryMail actually does and gives
> the works council and the employer a shared basis for negotiation. Every clause must be
> adapted to the individual workplace and reviewed by employment counsel before it is signed.
> Placeholders in `[square brackets]` must be filled in.
>
> The German original (`betriebsvereinbarung-vorlage.md`) is the authoritative version for
> works agreements under German law; this translation is provided for international teams and
> for group-wide coordination.

Between

**[Company name]**, represented by [name, position] — hereinafter "the Employer" —

and

the **[works council / staff council]** of [site / public authority], represented by [name] —
hereinafter "the Employee Representation" —

the following agreement is concluded.

---

## § 1 Subject matter and purpose

(1) This agreement governs the use of and the limits on the **SentryMail** software for
conducting simulated phishing attacks and accompanying awareness measures.

(2) The sole purpose is to measure and improve the security awareness of employees and to
evidence that training and awareness measures were carried out (including Art. 32 GDPR,
NIS2 Art. 21(2)(g), BSI IT-Grundschutz ORP.3, ISO/IEC 27001 A.6.3).

(3) **Monitoring the performance or conduct of individual employees is excluded.** The
results are not used to assess work performance, not for individual personnel measures and
not as grounds for disciplinary action.

## § 2 Scope

This agreement applies to all employees of the [site / authority] within the meaning of
§ 5 BetrVG [or § 4 BPersVG] as well as to [temporary workers / apprentices / …].

## § 3 Operating mode of the software

(1) SentryMail is operated exclusively on systems under the Employer's control
([location / data centre]). No data is transmitted to the vendor or to third parties.

(2) The software's **data protection and co-determination mode** is permanently enabled. It
technically enforces:

a) **Lock on individual-person evaluations.** Evaluations that name individual employees are
   refused by the application — not merely hidden, but rejected server-side. This covers in
   particular recipient lists, session histories, CSV exports, named risk rankings and the
   list of people who "failed".

b) **k-anonymity.** Group evaluations (e.g. by department, country, browser or campaign) are
   only released if at least **k = [5]** people are involved. Smaller groups are explicitly
   marked as "below threshold" so the gap remains visible. People are counted, not events.

c) **No client fingerprinting.** Collection of a technical browser fingerprint remains
   disabled. [Alternative: it is enabled with the consent of the Employee Representation; even
   then the fingerprint is never part of person-identifiable reports.]

(3) Changes to these settings are logged (§ 7) and must be reported to the Employee
Representation without delay.

## § 4 Data processed

(1) The following is processed per simulation participation:

| Data | Purpose |
|---|---|
| Email address, first and last name | Delivery of the simulated message |
| Department, position, criticality (point-in-time snapshot) | Group evaluation under § 3(2)(b) |
| Time of sending, opening, click, form submission | Effectiveness measurement |
| IP address | Technical delivery, abuse detection |
| Browser, operating system, device type (derived from the user agent) | Attack surface analysis |
| Country code (only if a local GeoIP database is installed) | Analysis, at country level only |
| Referrer, language setting, screen resolution | Attack surface analysis |

(2) **No content is captured.** The content of genuine emails, browsing behaviour outside the
simulation pages and the use of other applications are not recorded.

(3) **Credential capture.** Where a simulation page contains input fields, password-like
fields are masked **before** being stored; a plaintext password is never stored at any point.
The masked entries are additionally stored encrypted and are subject to the lock under
§ 3(2)(a).
[Alternative: credential capture is not used.]

## § 5 Roles and access rights

(1) The software technically separates three roles:

- **Administrator** — sets up campaigns and evaluates in aggregate. They have **no** access to
  individual-person evaluations unless an unlock under § 6 is in force.
- **Data protection officer** — decides on unlocks under § 6 and reads the log under § 7. They
  do not evaluate and do not change the configuration.
- **User** — no administrative rights.

(2) The data protection officer role is held by [name/position]. The Employee Representation
receives [read access to the log under § 7 / its own account with this role].

## § 6 Lifting the lock under the four-eyes principle

(1) In justified individual cases — in particular where a genuine attack is suspected or a
security incident is being handled — the lock under § 3(2)(a) may be lifted temporarily.

(2) The procedure is technically enforced:

a) An administrator submits a request and must state a **reason**.

b) The request is decided **solely by the data protection officer**. A request **cannot** be
   approved by the person who submitted it; the software prevents this at application **and**
   database level.

c) The unlock applies only to the requesting person, for at most **[24] hours**, and
   optionally only to **a single campaign**. Once it expires the lock takes effect again
   automatically.

d) Unlocks can be revoked early at any time.

(3) The Employee Representation is informed of every unlock granted [without delay / as part
of the quarterly reports under § 9].

## § 7 Logging

(1) The software keeps a tamper-evident log of: requests, approvals, rejections and
revocations under § 6 including their reasons, changes to the privacy settings, changes to
user accounts and roles, and each run of the automatic deletion under § 8.

(2) The log is visible to administrators and to the data protection officer. It serves solely
to verify compliance with this agreement and not to monitor conduct.

## § 8 Retention and deletion

(1) The retention period is **[180] days** from the start of a campaign.

(2) After it expires, the software anonymises completed campaigns automatically and
irreversibly: recipient email addresses and names as well as IP address, fingerprint,
referrer, user agent, screen resolution and language setting of the events are removed.

(3) Only anonymous metrics remain (such as how many people clicked, with which browser, in
which country). It therefore remains provable **how many** employees reacted, but no longer
**who**.

(4) The run is automatic; the time and scope of each run are logged under § 7.

## § 9 Informing employees and the Employee Representation

(1) Before the first simulation, employees are informed in general terms that phishing
simulations are conducted, for what purpose and under which rules. The timing of individual
simulations is not announced — otherwise the measurement would be worthless.

(2) The Employee Representation receives a [quarterly] report with the aggregated results and
an overview of the unlocks granted under § 6.

(3) Employees who fell for a simulation receive supportive guidance or training offers only.
**No automatic technical sanctions — in particular no account lockouts — take place.**

## § 10 Training assignment *(only where the training module is used)*

(1) The training module can assign training automatically when an individual risk score
exceeds a threshold. This constitutes monitoring of conduct within the meaning of
§ 87(1) no. 6 BetrVG and is hereby expressly agreed.

(2) The assignment is made by the machine; the underlying individual scores are not displayed
to anyone in the process. The completion status of a training course is visible to training
administration, the triggering individual scores are not.

(3) Missing a deadline results solely in an organisational reminder, never in a technical
lockout.

## § 11 Employee rights

Rights under Art. 15 to 21 GDPR remain unaffected. Employees address requests to
[data protection officer, contact details]. After anonymisation under § 8 no attribution to a
person is possible; a right of access is void to that extent.

## § 12 Final provisions

(1) This agreement enters into force on [date].

(2) It may be terminated with [three months'] notice to the end of a month. It continues to
have effect until a new agreement is concluded.

(3) In the event of material changes to the software — in particular new person-identifiable
evaluation capabilities — the parties will enter into negotiations without delay. The new
functions remain disabled until agreement is reached.

(4) Should any provision be invalid, the remainder of the agreement stays in force.

<br>

[Place], [date]

<br>

________________________  ________________________
For the Employer     For the Employee Representation
