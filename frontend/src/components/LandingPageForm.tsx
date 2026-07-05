/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FormEvent, useEffect, useState } from 'react'
import MarkdownEditor from './MarkdownEditor'
import { mdToHtml } from '../utils/markdown'
import Toggle from './Toggle'
import { useI18n } from '../i18n'
import type { LandingPage } from '../types'

export interface LandingPageFormValues {
  name: string
  html_content: string
  capture_credentials: boolean
  capture_passwords: boolean
  redirect_url: string | null
  markdown_source: string | null
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

  useEffect(() => {
    setName(initial?.name ?? '')
    setHtml(initial?.html_content ?? '')
    setCaptureCredentials(initial?.capture_credentials ?? false)
    setCapturePasswords(initial?.capture_passwords ?? false)
    setRedirectUrl(initial?.redirect_url ?? '')
    setMarkdown(initial?.markdown_source ?? '')
    setEditorMode(initial?.markdown_source ? 'markdown' : 'html')
  }, [initial])

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
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-4">
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">{t('form.content')}</span>
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
