import { useEffect, useState } from 'react'
import Badge from '../components/Badge'
import LandingPageForm, { LandingPageFormValues } from '../components/LandingPageForm'
import PageScaffold from '../components/PageScaffold'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { LandingPage } from '../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; page: LandingPage }

export default function LandingPagesPage() {
  const { t } = useI18n()
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
      setError(t('lp.err.save'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(page: LandingPage) {
    if (!window.confirm(t('common.confirmDelete', { name: page.name }))) return
    setError(null)
    try {
      await api.delete(`/landing-pages/${page.id}`)
      load()
    } catch {
      setError(t('lp.err.delete'))
    }
  }

  if (mode.kind !== 'list') {
    return (
      <PageScaffold title={mode.kind === 'edit' ? t('lp.editTitle') : t('lp.newTitle')} guidanceKey="landing-editor">
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
      title={t('nav.landingPages')}
      guidanceKey="landing-pages"
      actions={
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {t('lp.new')}
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {loading ? (
        <p className="text-text-secondary">{t('lp.loading')}</p>
      ) : pages.length === 0 ? (
        <p className="text-text-secondary">{t('lp.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('lp.capture')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.changed')}</th>
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
                          ? t('lp.capture.dataPw')
                          : t('lp.capture.dataOnly')
                        : t('lp.capture.off')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {new Date(page.updated_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => setMode({ kind: 'edit', page })} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => handleDelete(page)} className="text-status-danger hover:underline">
                      {t('common.delete')}
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
