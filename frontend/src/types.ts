/** Spiegelt app/schemas.py im Backend. */

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled'

export interface Template {
  id: string
  name: string
  subject: string
  html_content: string
  text_content: string | null
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
  status: CampaignStatus
  scheduled_at: string | null
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface CampaignResult {
  campaign_id: string
  total_recipients: number
  sent: number
  opened: number
  clicked: number
  submitted: number
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

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
}

export interface LandingPage {
  id: string
  name: string
  html_content: string
  capture_credentials: boolean
  capture_passwords: boolean
  redirect_url: string | null
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id?: string
  email: string
  first_name?: string | null
  last_name?: string | null
  position?: string | null
}

export interface Group {
  id: string
  name: string
  created_at: string
  updated_at: string
  members: GroupMember[]
}

export interface GroupSummary {
  id: string
  name: string
  member_count: number
  created_at: string
  updated_at: string
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
}

export interface LdapConfig {
  enabled: boolean
  host: string
  port: number
  use_ssl: boolean
  start_tls: boolean
  bind_dn: string
  has_bind_password: boolean
  base_dn: string
  user_filter: string
  attr_email: string
  attr_first_name: string
  attr_last_name: string
}
