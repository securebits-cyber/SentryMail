import { useEffect, useState } from 'react'
import Badge from '../components/Badge'
import LandingPageForm, { LandingPageFormValues } from '../components/LandingPageForm'
import PageScaffold from '../components/PageScaffold'
import { api } from '../services/api'
import type { LandingPage } from '../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; page: LandingPage }

export default function LandingPagesPage() {
  const [pages, setPages] = useState<LandingPage[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .get<LandingPage[]>('/landing-pages')
      .then((res) => setPages(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleSubmit(values: LandingPageFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      if (mode.kind === 'edit') {
        await api.patch(`/landing-pages/${mode.page.id}`, values)
      } else {
        await api.post('/landing-pages', values)
      }
      setMode({ kind: 'list' })
      load()
    } catch {
      setError('Landing Page konnte nicht gespeichert werden.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(page: LandingPage) {
    if (!window.confirm(`Landing Page „${page.name}“ wirklich löschen?`)) return
    setError(null)
    try {
      await api.delete(`/landing-pages/${page.id}`)
      load()
    } catch {
      setError('Landing Page konnte nicht gelöscht werden.')
    }
  }

  if (mode.kind !== 'list') {
    return (
      <PageScaffold title={mode.kind === 'edit' ? 'Landing Page bearbeiten' : 'Neue Landing Page'}>
        {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
        <LandingPageForm
          initial={mode.kind === 'edit' ? mode.page : null}
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
      title="Landing Pages"
      guidanceKey="landing-pages"
      actions={
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Neue Landing Page
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">Lade Landing Pages...</p>
      ) : pages.length === 0 ? (
        <p className="text-text-secondary">Noch keine Landing Page vorhanden &rarr; Erste Landing Page anlegen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Daten-Capture</th>
                <th className="py-2 pr-4 font-medium">Geändert</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-border">
                  <td className="py-2 pr-4">{page.name}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={page.capture_credentials ? 'accent' : 'neutral'}>
                      {page.capture_credentials
                        ? page.capture_passwords
                          ? 'Daten + Passwörter'
                          : 'Nur Daten'
                        : 'Aus'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {new Date(page.updated_at).toLocaleString('de-DE')}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => setMode({ kind: 'edit', page })} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      Bearbeiten
                    </button>
                    <button onClick={() => handleDelete(page)} className="text-status-danger hover:underline">
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
