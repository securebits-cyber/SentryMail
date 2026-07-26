/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Activity, Download, ScrollText, Settings, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/Badge'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { AuditEvent, AuditEventList, ChainStatus } from '../../types'

function initial(ev: AuditEvent): string {
  return (ev.actor_name || ev.actor_email || '?').trim().charAt(0).toUpperCase()
}

export default function AuditEventsPage() {
  const { t } = useI18n()
  const [data, setData] = useState<AuditEventList | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [chain, setChain] = useState<ChainStatus | null>(null)

  function load() {
    api
      .get<AuditEventList>('/audit-events', { params: { limit: 100 } })
      .then((res) => setData(res.data))
      .catch(() => setError(t('audit.err.load')))
  }

  useEffect(load, [])

  // Nachweiskette (Welle 9.3): Ein Bruch soll sichtbar sein, ohne dass jemand
  // erst ein Paket exportieren muss.
  useEffect(() => {
    api.get<ChainStatus>('/audit-events/chain').then((r) => setChain(r.data)).catch(() => undefined)
  }, [])

  function downloadEvidence() {
    api
      .get('/audit-events/evidence-package', { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `sentrymail-nachweis-${new Date().toISOString().slice(0, 10)}.zip`
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setError(t('chain.err.export')))
  }

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.events
    return data.events.filter((e) =>
      [e.actor_name, e.actor_email, e.action, e.description, e.ip ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <PageScaffold
      title={t('settings.auditEvents')}
      subtitle={t('audit.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.activity'), icon: Activity },
        { label: t('settings.auditEvents'), icon: ScrollText },
      ]}
      guidanceKey="settings-audit"
    >
      {error && <p className="mb-4 text-sm text-status-danger">{error}</p>}

      {/* Nachweiskette: Zustand und Export */}
      {chain && (
        <div
          className={`mb-5 max-w-3xl rounded-lg border p-4 ${
            chain.intact ? 'border-border bg-surface' : 'border-status-danger/40 bg-status-danger/10'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {chain.intact ? (
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-status-success" />
              ) : (
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-status-danger" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {chain.intact ? t('chain.intact') : t('chain.broken')}
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {t('chain.desc', { entries: chain.entries })}
                </p>
              </div>
            </div>
            <button
              onClick={downloadEvidence}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm"
            >
              <Download size={14} />
              {t('chain.export')}
            </button>
          </div>

          {!chain.intact && (
            <ul className="mt-3 flex flex-col gap-1 text-sm text-status-danger">
              {chain.problems.map((p, i) => (
                <li key={`${p.seq}-${p.code}-${i}`}>{t(`chain.problem.${p.code}`, { seq: p.seq })}</li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-sm text-text-secondary">{t('chain.verifyHint')}</p>
        </div>
      )}

      {!data ? (
        <p className="text-text-secondary">{t('audit.loading')}</p>
      ) : (
        <div className="max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="text-sm text-text-secondary">
              <span className="font-mono text-text-primary">{data.total}</span> {t('audit.events')}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('audit.search')}
              className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-text-secondary">{t('audit.noMatch')}</p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((ev) => (
                <li key={ev.id} className="flex gap-3 border-l border-border pl-4 pb-5 last:pb-0">
                  <div className="-ml-[33px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium text-text-secondary">
                    {initial(ev)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="text-sm">
                        <span className="font-medium">{ev.actor_name || t('audit.system')}</span>
                        {ev.actor_email && <span className="ml-2 text-text-secondary">{ev.actor_email}</span>}
                      </div>
                      <div className="font-mono text-xs text-text-secondary">
                        {new Date(ev.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={ev.category === 'auth' ? 'accent' : 'neutral'}>
                          {ev.category === 'auth' ? t('audit.cat.auth') : t('audit.cat.system')}
                        </Badge>
                        <span className="font-mono text-xs text-text-secondary">{ev.action}</span>
                      </div>
                      <p className="mt-2 text-text-primary">{ev.description}</p>
                      {ev.ip && <p className="mt-1 font-mono text-xs text-text-secondary">IP {ev.ip}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageScaffold>
  )
}
