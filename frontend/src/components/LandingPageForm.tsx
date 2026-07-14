/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Eye, Pencil, X } from 'lucide-react'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import AiGenerateBar from './AiGenerateBar'
import MarkdownEditor from './MarkdownEditor'
import { mdToHtml } from '../utils/markdown'
import Toggle from './Toggle'
import { useI18n } from '../i18n'
import type { LandingPage } from '../types'

// Platzhalter für die Vorschau mit Beispieldaten füllen (die Tracking-URL wird
// erst beim Ausliefern gesetzt; hier nur Anzeige).
function fillSample(html: string): string {
  return html
    .replace(/\{\{\s*(recipient_name|first_name)\s*\}\}/g, 'Max Mustermann')
    .replace(/\{\{\s*last_name\s*\}\}/g, 'Mustermann')
    .replace(/\{\{\s*(recipient_email|email)\s*\}\}/g, 'max.mustermann@example.com')
    .replace(/\{\{\s*(click_link|link)\s*\}\}/g, '#')
}

export interface LandingPageFormValues {
  name: string
  html_content: string
  capture_credentials: boolean
  capture_passwords: boolean
  redirect_url: string | null
  markdown_source: string | null
  logo_b64: string | null
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
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [html, setHtml] = useState('')
  const [captureCredentials, setCaptureCredentials] = useState(false)
  const [capturePasswords, setCapturePasswords] = useState(false)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [editorMode, setEditorMode] = useState<'html' | 'markdown'>('html')
  const [markdown, setMarkdown] = useState('')
  const [logoB64, setLogoB64] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // {{ logo }} in der Vorschau durch das Bild ersetzen (data:-URI rendert im Browser).
  const previewHtml = useMemo(
    () =>
      fillSample(
        html.replace(
          /\{\{\s*logo\s*\}\}/g,
          logoB64 ? `<img src="${logoB64}" alt="" style="max-height:60px">` : '',
        ),
      ),
    [html, logoB64],
  )

  useEffect(() => {
    setName(initial?.name ?? '')
    setHtml(initial?.html_content ?? '')
    setCaptureCredentials(initial?.capture_credentials ?? false)
    setCapturePasswords(initial?.capture_passwords ?? false)
    setRedirectUrl(initial?.redirect_url ?? '')
    setMarkdown(initial?.markdown_source ?? '')
    setLogoB64(initial?.logo_b64 ?? null)
    setEditorMode(initial?.markdown_source ? 'markdown' : 'html')
  }, [initial])

  function setLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoB64(String(reader.result)) // vollständiger data:image/...-URI
    reader.readAsDataURL(file)
  }

  function onMarkdownChange(value: string) {
    setMarkdown(value)
    setHtml(mdToHtml(value))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      html_content: html,
      capture_credentials: captureCredentials,
      // Passwoerter nur erfassen, wenn ueberhaupt Daten erfasst werden.
      capture_passwords: captureCredentials && capturePasswords,
      redirect_url: redirectUrl.trim() || null,
      markdown_source: editorMode === 'markdown' ? markdown : null,
      logo_b64: logoB64,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-4">
      <AiGenerateBar<{ html: string }>
        endpoint="/ai/generate-landing"
        tier="enterprise"
        placeholder={t('ai.gen.landing.placeholder')}
        onResult={(d) => {
          setEditorMode('html')
          setHtml(d.html)
        }}
      />
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">{t('form.content')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-primary hover:bg-bg"
            >
              {showPreview ? <Pencil size={13} /> : <Eye size={13} />}
              {showPreview ? t('lpf.hidePreview') : t('lpf.preview')}
            </button>
            <div className="flex gap-0.5 rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setEditorMode('html')}
                className={`rounded px-2 py-1 ${editorMode === 'html' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('markdown')}
                className={`rounded px-2 py-1 ${editorMode === 'markdown' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Markdown
              </button>
            </div>
          </div>
        </div>
        {editorMode === 'markdown' ? (
          <>
            <MarkdownEditor value={markdown} onChange={onMarkdownChange} rows={14} placeholder="# Willkommen\n\nBitte melde dich an." />
            <p className="text-xs text-text-secondary">{t('lpf.markdownNote')}</p>
          </>
        ) : (
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={14}
            placeholder="<html>… Formular, das auf die Tracking-URL abgeschickt wird …</html>"
            className={`${fieldClass} font-mono text-sm`}
          />
        )}

        {showPreview && (
          <div className="mt-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">{t('lpf.previewHeading')}</span>
              <span className="text-xs text-text-secondary">{t('lpf.previewNote')}</span>
            </div>
            {html.trim() ? (
              <iframe
                title={t('lpf.preview')}
                srcDoc={previewHtml}
                sandbox=""
                className="h-96 w-full rounded-md border border-border bg-white"
              />
            ) : (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-secondary">
                {t('lpf.previewEmpty')}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">{t('lpf.logo')}</span>
          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-bg">
            {logoB64 ? t('lpf.logoReplace') : t('lpf.logoAdd')}
            <input type="file" accept="image/*" onChange={setLogo} className="hidden" />
          </label>
        </div>
        {logoB64 ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <img src={logoB64} alt="" className="max-h-10 max-w-[140px] object-contain" />
            <code className="font-mono text-xs text-text-secondary">{'{{ logo }}'}</code>
            <button
              type="button"
              onClick={() => setLogoB64(null)}
              className="ml-auto shrink-0 text-text-secondary hover:text-status-danger"
              aria-label={t('lpf.logoRemove')}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-text-secondary">{t('lpf.logoHint')}</p>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Toggle checked={captureCredentials} onChange={setCaptureCredentials} aria-label={t('lpf.captureData')} />
        {t('lpf.captureData')}
      </div>
      <div className={`flex items-center gap-3 text-sm ${captureCredentials ? '' : 'opacity-50'}`}>
        <Toggle
          checked={capturePasswords}
          onChange={setCapturePasswords}
          disabled={!captureCredentials}
          aria-label={t('lpf.capturePw')}
        />
        {t('lpf.capturePw')}
      </div>

      <label className={labelClass}>
        {t('lpf.redirect')}
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
          {submitting ? t('common.saving') : initial ? t('form.saveChanges') : t('lpf.create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
