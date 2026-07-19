/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FileDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import Card from '../../components/Card'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import { downloadCertificate } from '../trainings'

interface CompletionRow {
  completion_id: string
  assignment_id: string
  user_email: string | null
  course_title: string | null
  course_version: number
  reason: string
  assigned_at: string
  completed_at: string
  evidence_hash: string
  quiz_score_percent: number | null
}

/**
 * Abschluss-Report (Admin). Bewusst ohne Enterprise-Gate: Die Nachweise
 * bleiben auch nach Ablauf des Add-ons lesbar (Nachweispflicht des Kunden) —
 * das Backend erzwingt nur Auth + Admin-Rolle.
 */
export default function LmsReportsPage() {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<CompletionRow[]>([])

  useEffect(() => {
    api.get<CompletionRow[]>('/lms/reports/completions').then((r) => setRows(r.data))
  }, [])

  async function downloadCsv() {
    const res = await api.get<Blob>('/lms/reports/completions?format=csv', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'lms-completions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB')

  return (
    <PageScaffold
      title={t('nav.lmsReports')}
      subtitle={t('lms.reports.subtitle')}
      guidanceKey="lms-reports"
      actions={
        <button
          onClick={() => void downloadCsv()}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-50"
        >
          <FileDown size={15} />
          {t('lms.reports.csv')}
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-text-secondary">{t('lms.reports.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('lms.assign.user')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.course')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.reports.version')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.reports.reason')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.completedAt')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.reports.quiz')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.completion_id} className="border-b border-border" title={`${t('lms.reports.evidence')}: ${row.evidence_hash}`}>
                  <td className="py-2 pr-4">{row.user_email ?? '—'}</td>
                  <td className="py-2 pr-4">{row.course_title ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">v{row.course_version}</td>
                  <td className="py-2 pr-4 text-text-secondary">
                    {t(`lms.reports.reason.${row.reason}`)}
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{fmtDate(row.completed_at)}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">
                    {row.quiz_score_percent !== null ? `${row.quiz_score_percent} %` : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => void downloadCertificate(row.completion_id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:bg-bg"
                    >
                      <FileDown size={13} />
                      {t('lms.certificate')}
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
