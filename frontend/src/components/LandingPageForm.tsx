import { FormEvent, useEffect, useState } from 'react'
import type { LandingPage } from '../types'

export interface LandingPageFormValues {
  name: string
  html_content: string
  capture_credentials: boolean
  capture_passwords: boolean
  redirect_url: string | null
}

interface LandingPageFormProps {
  initial?: LandingPage | null
  onSubmit: (values: LandingPageFormValues) => void
  onCancel: () => void
  submitting?: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function LandingPageForm({ initial, onSubmit, onCancel, submitting }: LandingPageFormProps) {
  const [name, setName] = useState('')
  const [html, setHtml] = useState('')
  const [captureCredentials, setCaptureCredentials] = useState(false)
  const [capturePasswords, setCapturePasswords] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState('')

  useEffect(() => {
    setName(initial?.name ?? '')
    setHtml(initial?.html_content ?? '')
    setCaptureCredentials(initial?.capture_credentials ?? false)
    setCapturePasswords(initial?.capture_passwords ?? false)
    setRedirectUrl(initial?.redirect_url ?? '')
  }, [initial])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      html_content: html,
      capture_credentials: captureCredentials,
      // Passwoerter nur erfassen, wenn ueberhaupt Daten erfasst werden.
      capture_passwords: captureCredentials && capturePasswords,
      redirect_url: redirectUrl.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-4">
      <label className={labelClass}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <label className={labelClass}>
        HTML-Inhalt
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={14}
          required
          placeholder="<html>… Formular, das auf die Tracking-URL abgeschickt wird …</html>"
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={captureCredentials}
          onChange={(e) => setCaptureCredentials(e.target.checked)}
        />
        Abgeschickte Formulardaten erfassen
      </label>
      <label className={`flex items-center gap-2 text-sm ${captureCredentials ? '' : 'opacity-50'}`}>
        <input
          type="checkbox"
          checked={capturePasswords}
          disabled={!captureCredentials}
          onChange={(e) => setCapturePasswords(e.target.checked)}
        />
        Auch Passwörter erfassen
      </label>

      <label className={labelClass}>
        Weiterleitung nach Absenden (optional)
        <input
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
          placeholder="https://intranet.example.com/awareness"
          className={fieldClass}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Speichern...' : initial ? 'Änderungen speichern' : 'Landing Page anlegen'}
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
