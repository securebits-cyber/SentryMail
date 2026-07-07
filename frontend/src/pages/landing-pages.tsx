/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { BookOpen, KeyRound, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import Badge from '../components/Badge'
import LandingPageForm, { LandingPageFormValues } from '../components/LandingPageForm'
import PageScaffold from '../components/PageScaffold'
import TierBadge from '../components/TierBadge'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { LandingPage } from '../types'

interface LibraryLandingPage {
  id: string
  category: string
  name: string
  captures_passwords: boolean
}

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; page: LandingPage } | { kind: 'library' }

export default function LandingPagesPage() {
  const { t } = useI18n()
  // Die Landing-Page-Bibliothek ist ein Business-Feature (im Add-on).
  const features = useFeatures()
  const businessLicensed = Boolean(features?.features?.business)
  const [pages, setPages] = useState<LandingPage[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [library, setLibrary] = useState<LibraryLandingPage[]>([])

  function load() {
    setLoading(true)
    api
      .get<LandingPage[]>('/landing-pages')
      .then((res) => setPages(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function openLibrary() {
    if (!businessLicensed) {
      setError(t('locked.body'))
      return
    }
    setError(null)
    try {
      const res = await api.get<LibraryLandingPage[]>('/landing-page-library')
      setLibrary(res.data)
      setMode({ kind: 'library' })
    } catch {
      setError(t('lp.err.save'))
    }
  }

  async function cloneFromLibrary(libId: string) {
    setError(null)
    try {
      const res = await api.post<LandingPage>(`/landing-page-library/${libId}/clone`)
      load()
      setMode({ kind: 'edit', page: res.data })
    } catch {
      setError(t('lp.err.save'))
    }
  }

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

  if (mode.kind === 'library') {
    return (
      <PageScaffold
        title={t('lp.library.title')}
        actions={
          <button
            onClick={() => {
              setMode({ kind: 'list' })
              setError(null)
            }}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg"
          >
            {t('lp.library.back')}
          </button>
        }
      >
        <p className="mb-4 max-w-2xl text-sm text-text-secondary">{t('lp.library.intro')}</p>
        {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {library.map((item) => (
            <div key={item.id} className="elevated flex flex-col rounded-lg border border-border bg-surface p-4">
              <span className="mb-2 w-fit rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                {item.category}
              </span>
              <h3 className="font-semibold text-text-primary">{item.name}</h3>
              {item.captures_passwords && (
                <p className="mt-1 flex flex-1 items-center gap-1.5 text-sm text-text-secondary">
                  <KeyRound size={14} />
                  {t('lp.library.capturesPw')}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => cloneFromLibrary(item.id)}
                  className="bg-accent w-fit rounded-md px-3 py-1.5 text-sm font-medium text-white"
                >
                  {t('lp.library.use')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </PageScaffold>
    )
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
        <div className="flex items-center gap-2">
          <button
            onClick={openLibrary}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg"
          >
            <BookOpen size={15} />
            {t('lp.library')}
            <TierBadge tier="business" locked={!businessLicensed} />
            {!businessLicensed && <Lock size={13} className="text-text-secondary" />}
          </button>
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {t('lp.new')}
          </button>
        </div>
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
