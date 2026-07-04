import { FormEvent, useEffect, useState } from 'react'
import type { Template } from '../types'

export interface TemplateFormValues {
  name: string
  subject: string
  html_content: string
}

interface TemplateFormProps {
  initial?: Template | null
  onSubmit: (values: TemplateFormValues) => void
  onCancel: () => void
  submitting?: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function TemplateForm({ initial, onSubmit, onCancel, submitting }: TemplateFormProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')

  useEffect(() => {
    setName(initial?.name ?? '')
    setSubject(initial?.subject ?? '')
    setHtmlContent(initial?.html_content ?? '')
  }, [initial])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ name, subject, html_content: htmlContent })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <label className={labelClass}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <label className={labelClass}>
        Betreff
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required className={fieldClass} />
      </label>

      <label className={labelClass}>
        HTML-Inhalt
        <textarea
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          rows={14}
          required
          placeholder="<p>Hallo {{.FirstName}}, ...</p>"
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Speichern...' : initial ? 'Aenderungen speichern' : 'Vorlage anlegen'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
