import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import PageScaffold from '../components/PageScaffold'
import TemplateForm, { TemplateFormValues } from '../components/TemplateForm'
import { api } from '../services/api'
import type { Template } from '../types'

type Mode =
  | { kind: 'list' }
  | { kind: 'create'; draft?: TemplateFormValues }
  | { kind: 'edit'; template: Template }

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    api
      .get<Template[]>('/templates')
      .then((res) => setTemplates(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

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
      setError('Vorlage konnte nicht gespeichert werden.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(template: Template) {
    if (!window.confirm(`Vorlage „${template.name}“ wirklich löschen?`)) return
    setError(null)
    try {
      await api.delete(`/templates/${template.id}`)
      load()
    } catch {
      setError('Vorlage konnte nicht gelöscht werden.')
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
      setError('E-Mail konnte nicht importiert werden (gültige .eml-Datei?).')
    }
  }

  if (mode.kind !== 'list') {
    return (
      <PageScaffold title={mode.kind === 'edit' ? 'Vorlage bearbeiten' : 'Neue Vorlage'}>
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
      title="Vorlagen"
      guidanceKey="templates"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg"
          >
            E-Mail hochladen
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white">
              Business
            </span>
          </button>
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Neue Vorlage
          </button>
        </div>
      }
    >
      <input ref={fileInputRef} type="file" accept=".eml,message/rfc822" onChange={handleFile} className="hidden" />

      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">Lade Vorlagen...</p>
      ) : templates.length === 0 ? (
        <p className="text-text-secondary">Noch keine Vorlage vorhanden &rarr; Erste Vorlage anlegen oder eine E-Mail hochladen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Betreff</th>
                <th className="py-2 pr-4 font-medium">Geändert</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-border">
                  <td className="py-2 pr-4">{template.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{template.subject}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {new Date(template.updated_at).toLocaleString('de-DE')}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => setMode({ kind: 'edit', template })}
                      className="mr-3 text-text-secondary hover:text-accent hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button onClick={() => handleDelete(template)} className="text-status-danger hover:underline">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageScaffold>
  )
}
