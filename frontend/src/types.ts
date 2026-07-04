/** Spiegelt app/schemas.py im Backend. */

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled'

export interface Template {
  id: string
  name: string
  subject: string
  html_content: string
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
