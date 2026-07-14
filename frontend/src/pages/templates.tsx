/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { BookOpen, Globe, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '../components/Card'
import PageScaffold from '../components/PageScaffold'
import TemplateForm, { TemplateFormValues } from '../components/TemplateForm'
import TierBadge from '../components/TierBadge'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { Template } from '../types'

interface LibraryTemplate {
  id: string
  category: string
  name: string
  subject: string
  html_content: string
  text_content: string | null
  has_landing: boolean
}

type Mode =
  | { kind: 'list' }
  | { kind: 'create'; draft?: TemplateFormValues }
  | { kind: 'edit'; template: Template }
  | { kind: 'library' }

export default function TemplatesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // E-Mail-Upload und Vorlagen-Bibliothek sind Business-Features (im Add-on).
  const features = useFeatures()
  const businessLicensed = Boolean(features?.features?.business)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibraryTemplate[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    api
      .get<Template[]>('/templates')
      .then((res) => setTemplates(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Sidebar-Untermenue "Neue Vorlage erstellen" oeffnet die Seite mit ?new=1.
  // Create-Modus setzen und den Param wieder entfernen, damit er nicht kleben bleibt.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setMode({ kind: 'create' })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  async function handleSubmit(values: TemplateFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      if (mode.kind === 'edit') {
        await api.patch(`/templates/${mode.template.id}`, values)
      } else {
        await api.post('/templates', values)
      }
      setMode({ kind: 'list' })
      load()
    } catch {
      setError(t('tpl.err.save'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(template: Template) {
    if (!window.confirm(t('common.confirmDelete', { name: template.name }))) return
    setError(null)
    try {
      await api.delete(`/templates/${template.id}`)
      load()
    } catch {
      setError(t('tpl.err.delete'))
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // erlaubt erneutes Auswählen derselben Datei
    if (!file) return
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<TemplateFormValues>('/templates/import-eml', form)
      setMode({ kind: 'create', draft: res.data })
    } catch {
      setError(t('tpl.err.import'))
    }
  }

  async function openLibrary() {
    if (!businessLicensed) {
      setError(t('locked.body'))
      return
    }
    setError(null)
    try {
      const res = await api.get<LibraryTemplate[]>('/template-library')
      setLibrary(res.data)
      setMode({ kind: 'library' })
    } catch {
      setError(t('tpl.err.import'))
    }
  }

  async function cloneFromLibrary(libId: string) {
    setError(null)
    try {
      const res = await api.post<Template>(`/template-library/${libId}/clone`)
      load()
      setMode({ kind: 'edit', template: res.data })
    } catch {
      setError(t('tpl.err.save'))
    }
  }

  async function cloneLandingFromLibrary(libId: string) {
    setError(null)
    try {
      await api.post(`/template-library/${libId}/clone-landing`)
      // Die passende Landing Page landet als editierbare Core-Seite -> dorthin wechseln.
      navigate('/landing-pages')
    } catch {
      setError(t('tpl.err.save'))
    }
  }

  if (mode.kind === 'library') {
    return (
      <PageScaffold
        title={t('tpl.library.title')}
        actions={
          <button
            onClick={() => {
              setMode({ kind: 'list' })
              setError(null)
            }}
            className="rounded-full border border-border px-5 py-2.5 text-sm text-text-primary hover:bg-bg"
          >
            {t('tpl.library.back')}
          </button>
        }
      >
        <p className="mb-4 max-w-2xl text-sm text-text-secondary">{t('tpl.library.intro')}</p>
        {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {library.map((item) => (
            <div key={item.id} className="elevated flex flex-col rounded-lg border border-border bg-surface p-5">
              <span className="mb-2 w-fit rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-text">
                {item.category}
              </span>
              <h3 className="font-semibold text-text-primary">{item.name}</h3>
              <p className="mt-1 flex-1 text-sm text-text-secondary">{item.subject}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => cloneFromLibrary(item.id)}
                  className="bg-accent w-fit rounded-full px-4 py-1.5 text-sm font-medium text-white"
                >
                  {t('tpl.library.use')}
                </button>
                {item.has_landing && (
                  <button
                    onClick={() => cloneLandingFromLibrary(item.id)}
                    className="flex w-fit items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-bg"
                  >
                    <Globe size={14} />
                    {t('tpl.library.landing')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PageScaffold>
    )
  }

  if (mode.kind !== 'list') {
    return (
      <PageScaffold title={mode.kind === 'edit' ? t('tpl.editTitle') : t('tpl.newTitle')} guidanceKey="template-editor">
        {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
        <TemplateForm
          initial={mode.kind === 'edit' ? mode.template : mode.kind === 'create' ? mode.draft ?? null : null}
          isEdit={mode.kind === 'edit'}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode({ kind: 'list' })
            setError(null)
          }}
          submitting={submitting}
        />
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title={t('nav.templates')}
      guidanceKey="templates"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={openLibrary}
            className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-text-primary hover:bg-bg"
          >
            <BookOpen size={15} />
            {t('tpl.library')}
            <TierBadge tier="business" locked={!businessLicensed} />
            {!businessLicensed && <Lock size={13} className="text-text-secondary" />}
          </button>
          <button
            onClick={() => {
              if (!businessLicensed) {
                setError(t('locked.body'))
                return
              }
              fileInputRef.current?.click()
            }}
            className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-text-primary hover:bg-bg"
          >
            {t('tpl.upload')}
            <TierBadge tier="business" locked={!businessLicensed} />
            {!businessLicensed && <Lock size={13} className="text-text-secondary" />}
          </button>
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white"
          >
            {t('tpl.new')}
          </button>
        </div>
      }
    >
      <input ref={fileInputRef} type="file" accept=".eml,message/rfc822" onChange={handleFile} className="hidden" />

      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">{t('tpl.loading')}</p>
      ) : templates.length === 0 ? (
        <p className="text-text-secondary">{t('tpl.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.subject')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.changed')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-border">
                  <td className="py-2 pr-4">{template.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{template.subject}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {new Date(template.updated_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setMode({ kind: 'edit', template })}
                      className="mr-3 text-text-secondary hover:text-accent hover:underline"
                    >
                      {t('common.edit')}
                    </button>
                    <button onClick={() => handleDelete(template)} className="text-status-danger hover:underline">
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageScaffold>
  )
}
