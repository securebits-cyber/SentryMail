/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Spiegelt app/schemas.py im Backend. */

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled'

export interface TemplateAttachment {
  filename: string
  content_type: string
  content_b64: string
}

export interface Template {
  id: string
  name: string
  subject: string
  html_content: string
  text_content: string | null
  attachments: TemplateAttachment[]
  markdown_source: string | null
  logo_b64: string | null
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface RecipientInput {
  email: string
  first_name?: string
  last_name?: string
}

export interface Campaign {
  id: string
  name: string
  template_id: string
  sending_profile_id: string | null
  landing_page_id: string | null
  status: CampaignStatus
  scheduled_at: string | null
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface RecipientResult {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  sent_at: string | null
  opened: boolean
  clicked: boolean
  submitted: boolean
  visits: number
}

export interface RecipientEvent {
  event_type: string
  occurred_at: string
  browser: string | null
  os: string | null
  device_type: string | null
  country: string | null
  ip_address: string | null
  referrer: string | null
}

export interface CampaignResult {
  campaign_id: string
  total_recipients: number
  sent: number
  opened: number
  clicked: number
  submitted: number
  recipients: RecipientResult[]
  // Datenschutzmodus: recipients ist leer, weil gesperrt - nicht, weil die
  // Kampagne keine Empfaenger hat.
  individuals_locked?: boolean
}

export interface SeatStatus {
  max_users: number | null
  active_users: number
  over_limit: boolean
}

export interface FeaturesResponse {
  features: Record<string, boolean>
  license: { status: string; customer: string | null; expires: string | null }
  seats: SeatStatus
}

export interface VersionResponse {
  current: string
  latest: string | null
  update_available: boolean
  changelog_url: string | null
}

export interface LicenseStatus {
  instance_id: string
  status: string
  customer: string | null
  features: string[]
  expires_at: string | null
  license_expires: string | null
  last_checked_at: string | null
  has_key: boolean
  key_from_env: boolean
  server_configured: boolean
  max_users: number | null
  active_users: number
  over_limit: boolean
}

export interface SendingProfile {
  id: string
  name: string
  host: string
  port: number
  username: string | null
  from_email: string
  from_name: string
  tls_mode: 'none' | 'starttls' | 'ssl'
  ignore_cert_errors: boolean
  has_password: boolean
  created_at: string
  updated_at: string
}

// privacy_officer: Datenschutzbeauftragter/Personalrat - Kontrollrolle der
// Welle 2 (Freigaben, Audit-Einsicht), kein Betriebs- oder Auswerterzugriff.
export type UserRole = 'admin' | 'privacy_officer' | 'user'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_primary: boolean
  twofa_enabled: boolean
  created_at: string
}

export interface LandingPage {
  id: string
  name: string
  html_content: string
  capture_credentials: boolean
  capture_passwords: boolean
  redirect_url: string | null
  markdown_source: string | null
  logo_b64: string | null
  created_at: string
  updated_at: string
}

export type Criticality = 'low' | 'normal' | 'high'

export interface GroupMember {
  id?: string
  email: string
  first_name?: string | null
  last_name?: string | null
  position?: string | null
  department?: string | null
  criticality?: Criticality | null
  // Leitungsorgan (Geschaeftsfuehrung/Vorstand) - Grundlage des gesonderten
  // Nachweises nach § 38 BSIG.
  is_management?: boolean
}

// "manual" = im Dashboard verwaltet, "scim" = vom Identity Provider verwaltet
// und deshalb hier schreibgeschuetzt.
export type GroupSource = 'manual' | 'scim'

export interface Group {
  id: string
  name: string
  source?: GroupSource
  created_at: string
  updated_at: string
  members: GroupMember[]
}

export interface GroupSummary {
  id: string
  name: string
  source?: GroupSource
  member_count: number
  created_at: string
  updated_at: string
}

// --- Zwei-Faktor-Authentifizierung ---
export interface TwoFAStatus {
  method: string | null // "totp" | "email" | null
  enabled: boolean
  backup_codes_remaining: number
  required: boolean
}

export interface TotpSetup {
  secret: string
  provisioning_uri: string
  qr_data_uri: string
}

export interface TwoFAActivated {
  backup_codes: string[]
  access_token: string | null
}

export interface SecurityConfig {
  require_2fa: string // "off" | "admins" | "all"
}

// Vier-Augen-Freigabe: Ein Admin beantragt, der Datenschutzbeauftragte
// entscheidet. "expired" ist kein gespeicherter Status, sondern abgeleitet.
export type PrivacyUnlockStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired'

// Wer Freigaben erteilen darf. Leere Liste = das Vier-Augen-Verfahren laeuft
// ins Leere, die Oberflaeche warnt dann.
// SCIM-Anbindung (Business). Das Token wird nie zurueckgegeben - nur, ob eines
// gesetzt ist; last_seen_at ist beim Einrichten die einzige Rueckmeldung, dass
// der Identity Provider tatsaechlich ankommt.
export interface ScimConfig {
  enabled: boolean
  has_token: boolean
  last_seen_at: string | null
  users: number
  groups: number
}

export interface PrivacyOfficer {
  email: string
  full_name: string
}

export interface PrivacyUnlockRequest {
  id: string
  requested_by_email: string
  campaign_id: string | null
  reason: string
  duration_hours: number
  status: PrivacyUnlockStatus
  decided_by_email: string | null
  decided_at: string | null
  expires_at: string | null
  created_at: string
  active: boolean
}

export interface PrivacyConfig {
  fingerprinting_enabled: boolean
  privacy_mode_enabled: boolean
  k_anonymity_threshold: number
  // null = keine automatische Loeschung (Auslieferungszustand).
  retention_days: number | null
  retention_last_run_at: string | null
}

// Vorschau des naechsten Retention-Laufs - veraendert nichts.
export interface RetentionPreview {
  retention_days: number | null
  campaigns: number
  recipients: number
  events: number
}

// Audit-Log: Anmelde- und System-Aenderungsereignisse.
export interface AuditEvent {
  id: string
  created_at: string
  actor_email: string
  actor_name: string
  category: string
  action: string
  description: string
  ip: string | null
}

export interface AuditEventList {
  total: number
  events: AuditEvent[]
}

// Globales Fallback-SMTP — greift ohne Sending Profile, im Dashboard verwaltet.
export interface SmtpConfig {
  host: string
  port: number
  username: string
  has_password: boolean
  from_email: string
  from_name: string
  tls_mode: string
  verify_ssl: boolean
}

export interface OidcConfig {
  enabled: boolean
  issuer: string
  client_id: string
  has_client_secret: boolean
  redirect_uri: string
  trust_email: boolean
}

export interface LdapConfig {
  enabled: boolean
  host: string
  port: number
  use_ssl: boolean
  start_tls: boolean
  ca_cert: string
  bind_dn: string
  has_bind_password: boolean
  base_dn: string
  user_filter: string
  attr_email: string
  attr_first_name: string
  attr_last_name: string
}

// Gemeldete verdaechtige Mail (Business, Welle 7). report_count zaehlt, wie oft
// dieselbe Mail gemeldet wurde - das erste grobe Signal fuer den Umfang.
export interface ReportedMail {
  id: string
  reported_by_email: string
  reported_at: string
  report_count: number
  subject: string
  from_address: string
  attachment_count: number
  size_bytes: number
}

// Analyse einer gemeldeten Mail (Enterprise, Welle 7).
// urls sind **defanged** (hxxp://, [.]) — niemals als Link rendern.
export interface MailAnalysisAttachment {
  filename: string
  content_type: string
  size_bytes: number
  sha256: string
  risky: boolean
  archive: boolean
  // clean | infected | unavailable | error | disabled — "unavailable" heisst
  // ausdruecklich NICHT sauber, sondern ungeprueft.
  scan_result?: string
  scan_signature?: string | null
}

export interface MailAnalysisFinding {
  rule: string
  weight: number
  detail: string
}

export interface MispHit {
  indicator: string
  type: string
  category: string
  event_id: string
  event_info: string
}

export interface MailAnalysis {
  reported_mail_id: string
  // disabled | unavailable | checked - nur bei "checked" heisst eine leere
  // Trefferliste wirklich "nichts bekannt".
  intel_status?: string
  intel_hits?: MispHit[]
  spf_result: string
  dkim_result: string
  dmarc_result: string
  hop_count: number
  urls: string[]
  attachments: MailAnalysisAttachment[]
  findings: MailAnalysisFinding[]
  score: number
  level: 'high' | 'medium' | 'low'
  created_at: string
}

// Eine Welle: Meldungen mit gleichem Cluster-Schluessel (Enterprise).
export interface MailCluster {
  cluster_key: string
  subject: string
  sender_domain: string
  mails: number
  reports: number
  max_score: number
  level: 'high' | 'medium' | 'low'
  first_seen: string
  last_seen: string
}

export interface ThreatScanConfig {
  enabled: boolean
  host: string
  port: number
  timeout_seconds: number
}

export interface MispConfig {
  enabled: boolean
  url: string
  verify_ssl: boolean
  timeout_seconds: number
  has_api_key: boolean
}
