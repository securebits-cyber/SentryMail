/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import Badge from './Badge'
import { useI18n } from '../i18n'
import type { CampaignResult } from '../types'

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

export default function ResultsTable({ result }: ResultsTableProps) {
  const { t } = useI18n()
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
                  <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                  <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.sent')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.opened')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.col.clicked')}</th>
                  <th className="py-2 font-medium">{t('res.col.submitted')}</th>
                </tr>
              </thead>
              <tbody>
                {result.recipients.map((r) => (
                  <tr key={r.email} className="border-b border-border">
                    <td className="py-2 pr-4 font-mono text-sm">{r.email}</td>
                    <td className="py-2 pr-4">{[r.first_name, r.last_name].filter(Boolean).join(' ')}</td>
                    <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-4">{yesNo(r.opened, t('res.badge.opened'), 'success')}</td>
                    <td className="py-2 pr-4">{yesNo(r.clicked, t('res.badge.clicked'), 'warning')}</td>
                    <td className="py-2">{yesNo(r.submitted, t('res.badge.submitted'), 'danger')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
