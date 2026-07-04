import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import TemplateForm, { TemplateFormValues } from '../components/TemplateForm'
import { api } from '../services/api'
import type { Template } from '../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; template: Template }

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (mode.kind !== 'list') {
    return (
      <>
        <PageHeader title={mode.kind === 'edit' ? 'Vorlage bearbeiten' : 'Neue Vorlage'} />
        {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
        <TemplateForm
          initial={mode.kind === 'edit' ? mode.template : null}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode({ kind: 'list' })
            setError(null)
          }}
          submitting={submitting}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Vorlagen"
        actions={
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Neue Vorlage
          </button>
        }
      />

      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">Lade Vorlagen...</p>
      ) : templates.length === 0 ? (
        <p className="text-text-secondary">Noch keine Vorlage vorhanden &rarr; Erste Vorlage anlegen.</p>
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
                      className="mr-3 text-accent hover:underline"
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
    </>
  )
}
