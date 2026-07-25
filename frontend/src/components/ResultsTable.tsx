/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import Badge from './Badge'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { CampaignResult, RecipientEvent, RecipientResult } from '../types'

interface ResultsTableProps {
  result: CampaignResult
}

const summaryRows: Array<{ labelKey: string; key: 'total_recipients' | 'sent' | 'opened' | 'clicked' | 'submitted' }> = [
  { labelKey: 'res.totalRecipients', key: 'total_recipients' },
  { labelKey: 'res.sent', key: 'sent' },
  { labelKey: 'res.opened', key: 'opened' },
  { labelKey: 'res.clicked', key: 'clicked' },
  { labelKey: 'res.submitted', key: 'submitted' },
]

function yesNo(active: boolean, label: string, tone: 'success' | 'warning' | 'danger') {
  return active ? <Badge tone={tone}>{label}</Badge> : <span className="text-text-secondary">—</span>
}

const EVENT_TONE: Record<string, 'success' | 'warning' | 'danger' | undefined> = {
  opened: 'success',
  clicked: 'warning',
  submitted: 'danger',
}

/** Session-Verlauf: chronologische Ereignis-Chronik eines Empfaengers (lazy geladen). */
function SessionHistory({ campaignId, recipient }: { campaignId: string; recipient: RecipientResult }) {
  const { t } = useI18n()
  const [events, setEvents] = useState<RecipientEvent[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<RecipientEvent[]>(`/results/${campaignId}/recipients/${recipient.id}/events`)
      .then((res) => {
        if (!cancelled) setEvents(res.data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [campaignId, recipient.id])

  if (error) return <p className="py-2 text-sm text-status-danger">{t('res.session.error')}</p>
  if (events === null) return <p className="py-2 text-sm text-text-secondary">{t('res.loading')}</p>
  if (events.length === 0) return <p className="py-2 text-sm text-text-secondary">{t('res.session.empty')}</p>

  return (
    <ol className="flex flex-col gap-1.5 py-2">
      {events.map((e, i) => {
        const meta = [e.browser, e.os, e.device_type, e.country, e.ip_address].filter(Boolean).join(' · ')
        return (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="w-40 shrink-0 font-mono text-xs tabular-nums text-text-secondary">
              {new Date(e.occurred_at).toLocaleString()}
            </span>
            <Badge tone={EVENT_TONE[e.event_type] ?? 'success'}>{t(`res.event.${e.event_type}`)}</Badge>
            {meta && <span className="text-xs text-text-secondary">{meta}</span>}
            {e.referrer && <span className="truncate text-xs text-text-secondary">← {e.referrer}</span>}
          </li>
        )
      })}
    </ol>
  )
}

export default function ResultsTable({ result }: ResultsTableProps) {
  const { t } = useI18n()
  const [openRow, setOpenRow] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8">
      <table className="min-w-[320px] border-collapse">
        <tbody>
          {summaryRows.map(({ labelKey, key }) => (
            <tr key={key} className="border-b border-border">
              <td className="py-2 pr-4 text-text-secondary">{t(labelKey)}</td>
              <td className="py-2 font-mono text-base font-semibold text-text-primary">{result[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('res.perRecipient')}</h2>
        {result.recipients.length === 0 ? (
          <p className="text-text-secondary">{t('res.noRecipients')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-sm text-text-secondary">
                  <th className="w-8 py-2" aria-label={t('res.session.heading')} />
                  <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                  <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.sent')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.opened')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.clicked')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.visits')}</th>
                  <th className="py-2 font-medium">{t('res.col.submitted')}</th>
                </tr>
              </thead>
              <tbody>
                {result.recipients.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-border">
                      <td className="py-2 pr-1">
                        <button
                          onClick={() => setOpenRow(openRow === r.id ? null : r.id)}
                          aria-expanded={openRow === r.id}
                          aria-label={t('res.session.heading')}
                          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-bg hover:text-text-primary"
                        >
                          {openRow === r.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="py-2 pr-4 font-mono text-sm">{r.email}</td>
                      <td className="py-2 pr-4">{[r.first_name, r.last_name].filter(Boolean).join(' ')}</td>
                      <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 pr-4">{yesNo(r.opened, t('res.badge.opened'), 'success')}</td>
                      <td className="py-2 pr-4">{yesNo(r.clicked, t('res.badge.clicked'), 'warning')}</td>
                      <td className="py-2 pr-4 font-mono text-sm tabular-nums">
                        {r.visits}
                        {r.visits > 1 && (
                          <span className="ml-1.5 align-middle">
                            <Badge tone="warning">{t('res.badge.revisit')}</Badge>
                          </span>
                        )}
                      </td>
                      <td className="py-2">{yesNo(r.submitted, t('res.badge.submitted'), 'danger')}</td>
                    </tr>
                    {openRow === r.id && (
                      <tr className="border-b border-border bg-bg/50">
                        <td />
                        <td colSpan={7}>
                          <SessionHistory campaignId={result.campaign_id} recipient={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
