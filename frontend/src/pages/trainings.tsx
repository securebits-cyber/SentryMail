/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FileDown, PlayCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import LockedFeatureNotice from '../components/LockedFeatureNotice'
import PageScaffold from '../components/PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'

export interface MyAssignment {
  id: string
  course_id: string
  course_title: string | null
  reason: string
  assigned_at: string
  due_at: string
  status: string
  completed_at: string | null
  completion_id: string | null
}

/** Lädt die PDF-Bescheinigung (auth-pflichtig) und stößt den Download an. */
export async function downloadCertificate(completionId: string): Promise<void> {
  const res = await api.get<Blob>(`/lms/my/completions/${completionId}/certificate`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `schulungsnachweis-${completionId}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

const statusStyles: Record<string, string> = {
  assigned: 'bg-sunken text-text-secondary',
  in_progress: 'bg-accent/10 text-accent-text',
  quiz_pending: 'bg-accent/10 text-accent-text',
  completed: 'bg-green-600/10 text-green-600',
  overdue: 'bg-status-danger/10 text-status-danger',
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] ?? 'bg-sunken text-text-secondary'}`}>
      {t(`lms.status.${status}`)}
    </span>
  )
}

export default function TrainingsPage() {
  const { t, lang } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [items, setItems] = useState<MyAssignment[]>([])

  useEffect(() => {
    if (!licensed) return
    api.get<MyAssignment[]>('/lms/my/assignments').then((r) => setItems(r.data))
  }, [licensed])

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('lms.myTitle')} subtitle={t('lms.mySubtitle')} guidanceKey="trainings">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB') : '—'

  return (
    <PageScaffold title={t('lms.myTitle')} subtitle={t('lms.mySubtitle')} guidanceKey="trainings">
      {items.length === 0 ? (
        <p className="text-text-secondary">{t('lms.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('lms.course')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.status')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.due')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.completedAt')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 pr-4">{item.course_title ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{fmtDate(item.due_at)}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{fmtDate(item.completed_at)}</td>
                  <td className="py-2 text-right">
                    <span className="inline-flex items-center gap-2">
                      {item.completion_id && (
                        <button
                          onClick={() => void downloadCertificate(item.completion_id!)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:bg-bg"
                        >
                          <FileDown size={14} />
                          {t('lms.certificate')}
                        </button>
                      )}
                      <Link
                        to={`/trainings/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:bg-bg"
                      >
                        <PlayCircle size={14} />
                        {t('lms.open')}
                      </Link>
                    </span>
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
