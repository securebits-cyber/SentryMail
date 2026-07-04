import { FormEvent, useState } from 'react'
import type { RecipientInput, Template } from '../types'

export interface CampaignFormValues {
  name: string
  template_id: string
  recipients: RecipientInput[]
}

interface CampaignFormProps {
  templates: Template[]
  onSubmit: (values: CampaignFormValues) => void
  submitting?: boolean
}

/** Erwartet CSV mit Spalten: email,first_name,last_name (Header optional). */
function parseRecipientsCsv(csv: string): RecipientInput[] {
  return csv
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith('email'))
    .map((line) => {
      const [email, first_name, last_name] = line.split(',').map((v) => v?.trim())
      return { email, first_name: first_name || undefined, last_name: last_name || undefined }
    })
    .filter((r) => r.email)
}

export default function CampaignForm({ templates, onSubmit, submitting }: CampaignFormProps) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [recipientsCsv, setRecipientsCsv] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      template_id: templateId,
      recipients: parseRecipientsCsv(recipientsCsv),
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', maxWidth: 480 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        Template
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        Empfaenger (CSV: email,first_name,last_name)
        <textarea
          value={recipientsCsv}
          onChange={(e) => setRecipientsCsv(e.target.value)}
          rows={6}
          placeholder="max.muster@example.com,Max,Muster"
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Wird angelegt...' : 'Kampagne anlegen'}
      </button>
    </form>
  )
}
