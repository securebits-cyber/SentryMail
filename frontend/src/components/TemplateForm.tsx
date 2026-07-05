import { FormEvent, useEffect, useState } from 'react'
import type { Template } from '../types'

export interface TemplateFormValues {
  name: string
  subject: string
  html_content: string
  text_content: string | null
}

interface TemplateFormProps {
  initial?: TemplateFormValues | Template | null
  isEdit?: boolean
  onSubmit: (values: TemplateFormValues) => void
  onCancel: () => void
  submitting?: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

const VARIABLES = ['{{ first_name }}', '{{ last_name }}', '{{ email }}', '{{ link }}']

// Beispielwerte fuer die Vorschau.
const SAMPLE: Record<string, string> = {
  first_name: 'Max',
  last_name: 'Muster',
  email: 'max.muster@example.com',
  link: 'https://phish.example.com/track/landing?t=abc123',
  recipient_name: 'Max',
  recipient_email: 'max.muster@example.com',
  click_link: 'https://phish.example.com/track/landing?t=abc123',
}

/** Ersetzt die bekannten Platzhalter mit Beispielwerten (nur fuer die Vorschau). */
function fillSample(text: string): string {
  return text.replace(
    /\{\{\s*(first_name|last_name|email|link|recipient_name|recipient_email|click_link)\s*\}\}/g,
    (_, key: string) => SAMPLE[key] ?? '',
  )
}

export default function TemplateForm({ initial, isEdit, onSubmit, onCancel, submitting }: TemplateFormProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [textContent, setTextContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    setName(initial?.name ?? '')
    setSubject(initial?.subject ?? '')
    setHtmlContent(initial?.html_content ?? '')
    setTextContent(initial?.text_content ?? '')
  }, [initial])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ name, subject, html_content: htmlContent, text_content: textContent.trim() || null })
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

      <div className="rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
        Variablen (in Betreff, HTML und Text nutzbar):{' '}
        {VARIABLES.map((v) => (
          <code key={v} className="mr-2 font-mono text-text-primary">
            {v}
          </code>
        ))}
      </div>

      <label className={labelClass}>
        HTML-Inhalt
        <textarea
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          rows={12}
          required
          placeholder="<p>Hallo {{ first_name }}, <a href=&quot;{{ link }}&quot;>hier klicken</a></p>"
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>

      <label className={labelClass}>
        Text-Teil (optional, Plain-Text-Alternative)
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          rows={5}
          placeholder="Hallo {{ first_name }}, ..."
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>

      <div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg"
        >
          {showPreview ? 'Vorschau ausblenden' : 'Vorschau (mit Beispieldaten)'}
        </button>
      </div>

      {showPreview && (
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-3 py-2 text-sm">
            <span className="text-text-secondary">Betreff:</span> {fillSample(subject)}
          </div>
          <div
            className="max-h-96 overflow-auto bg-white p-4 text-black"
            // Eigene Vorlage des Admins - Vorschau mit Beispieldaten.
            dangerouslySetInnerHTML={{ __html: fillSample(htmlContent) }}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Speichern...' : isEdit ? 'Änderungen speichern' : 'Vorlage anlegen'}
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
