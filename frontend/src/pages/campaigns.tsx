import { useEffect, useState } from 'react'
import CampaignForm, { CampaignFormValues } from '../components/CampaignForm'
import { api } from '../services/api'
import type { Template } from '../types'

export default function CampaignsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    api.get<Template[]>('/templates').then((res) => setTemplates(res.data))
  }, [])

  async function handleSubmit(values: CampaignFormValues) {
    setSubmitting(true)
    setMessage(null)
    try {
      await api.post('/campaigns', values)
      setMessage('Kampagne wurde angelegt.')
    } catch {
      setMessage('Kampagne konnte nicht angelegt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1>Neue Kampagne</h1>
      {templates.length === 0 ? (
        <p style={{ color: 'var(--color-fg-muted)' }}>Erst ein Template anlegen, bevor eine Kampagne erstellt werden kann.</p>
      ) : (
        <CampaignForm templates={templates} onSubmit={handleSubmit} submitting={submitting} />
      )}
      {message && <p style={{ marginTop: 'var(--space-md)' }}>{message}</p>}
    </>
  )
}
