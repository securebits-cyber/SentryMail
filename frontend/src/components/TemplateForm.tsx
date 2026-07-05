/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import MarkdownEditor from './MarkdownEditor'
import { mdToHtml } from '../utils/markdown'
import { useI18n } from '../i18n'
import type { Template, TemplateAttachment } from '../types'

export interface TemplateFormValues {
  name: string
  subject: string
  html_content: string
  text_content: string | null
  attachments: TemplateAttachment[]
  markdown_source: string | null
}

function formatSize(b64: string): string {
  const bytes = Math.floor((b64.length * 3) / 4)
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
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
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [textContent, setTextContent] = useState('')
  const [attachments, setAttachments] = useState<TemplateAttachment[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [editorMode, setEditorMode] = useState<'html' | 'markdown'>('html')
  const [markdown, setMarkdown] = useState('')

  useEffect(() => {
    setName(initial?.name ?? '')
    setSubject(initial?.subject ?? '')
    setHtmlContent(initial?.html_content ?? '')
    setTextContent(initial?.text_content ?? '')
    setAttachments(initial?.attachments ?? [])
    setMarkdown(initial?.markdown_source ?? '')
    setEditorMode(initial?.markdown_source ? 'markdown' : 'html')
  }, [initial])

  function onMarkdownChange(value: string) {
    setMarkdown(value)
    setHtmlContent(mdToHtml(value))
  }

  function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result)
        const b64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result
        setAttachments((prev) => [
          ...prev,
          { filename: file.name, content_type: file.type || 'application/octet-stream', content_b64: b64 },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      subject,
      html_content: htmlContent,
      text_content: textContent.trim() || null,
      attachments,
      markdown_source: editorMode === 'markdown' ? markdown : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <label className={labelClass}>
        {t('common.subject')}
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required className={fieldClass} />
      </label>

      <div className="rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
        {t('tf.variables')}{' '}
        {VARIABLES.map((v) => (
          <code key={v} className="mr-2 font-mono text-text-primary">
            {v}
          </code>
        ))}
      </div>

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
            <MarkdownEditor value={markdown} onChange={onMarkdownChange} rows={12} />
            <p className="text-xs text-text-secondary">{t('tf.markdownNote')}</p>
          </>
        ) : (
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={12}
            placeholder="<p>Hallo {{ first_name }}, <a href=&quot;{{ link }}&quot;>hier klicken</a></p>"
            className={`${fieldClass} font-mono text-sm`}
          />
        )}
      </div>

      <label className={labelClass}>
        {t('tf.textPart')}
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          rows={5}
          placeholder="Hallo {{ first_name }}, ..."
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">
            {t('tf.attachments')} {attachments.length > 0 && <span className="text-text-secondary">({attachments.length})</span>}
          </span>
          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-bg">
            {t('tf.addAttachment')}
            <input type="file" multiple onChange={addFiles} className="hidden" />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p className="text-xs text-text-secondary">{t('tf.noAttachments')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {attachments.map((att, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                <Paperclip size={14} className="shrink-0 text-text-secondary" />
                <span className="truncate">{att.filename}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-text-secondary">{formatSize(att.content_b64)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-text-secondary hover:text-status-danger"
                  aria-label={t('tf.removeAttachment')}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg"
        >
          {showPreview ? t('tf.hidePreview') : t('tf.showPreview')}
        </button>
      </div>

      {showPreview && (
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-3 py-2 text-sm">
            <span className="text-text-secondary">{t('common.subject')}:</span> {fillSample(subject)}
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
          {submitting ? t('common.saving') : isEdit ? t('form.saveChanges') : t('tf.create')}
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
