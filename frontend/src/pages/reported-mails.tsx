/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ChevronDown, ChevronRight, MailWarning, Paperclip, Upload } from 'lucide-react'
import { ChangeEvent, Fragment, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import Card from '../components/Card'
import LockedFeatureNotice from '../components/LockedFeatureNotice'
import MailAnalysisPanel from '../components/MailAnalysisPanel'
import PageScaffold from '../components/PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import RiskBadge from '../components/RiskBadge'
import type { MailCluster, ReportedMail } from '../types'

export default function ReportedMailsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  // Die Auswertung ist Enterprise; der Meldeweg selbst bleibt Business.
  const analysisLicensed = Boolean(features?.features?.enterprise)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [rows, setRows] = useState<ReportedMail[]>([])
  const [clusters, setClusters] = useState<MailCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function load() {
    setLoading(true)
    api
      .get<ReportedMail[]>('/reported-mails')
      .then((res) => setRows(res.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
    // Wellen gibt es nur mit Enterprise; ohne Lizenz bleibt der Abschnitt leer.
    api
      .get<MailCluster[]>('/reported-mails/clusters')
      .then((res) => setClusters(res.data))
      .catch(() => setClusters([]))
  }

  useEffect(() => {
    if (!licensed) {
      setLoading(false)
      return
    }
    load()
  }, [licensed])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<ReportedMail>('/reported-mails', form)
      setMessage({
        kind: 'info',
        // Eine erneute Meldung derselben Mail ist der Normalfall, kein Fehler.
        text: res.data.report_count > 1 ? t('rm.duplicate', { n: String(res.data.report_count) }) : t('rm.added'),
      })
      load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setMessage({ kind: 'error', text: typeof detail === 'string' ? detail : t('rm.err.upload') })
    } finally {
      setBusy(false)
    }
  }

  async function remove(mail: ReportedMail) {
    if (!window.confirm(t('rm.confirmDelete', { subject: mail.subject || t('rm.noSubject') }))) return
    try {
      await api.delete(`/reported-mails/${mail.id}`)
      load()
    } catch {
      setMessage({ kind: 'error', text: t('rm.err.delete') })
    }
  }

  const breadcrumb = [{ label: t('nav.reportedMails'), icon: MailWarning }]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('rm.title')} subtitle={t('rm.subtitle')} breadcrumb={breadcrumb} guidanceKey="reported-mails">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )

  return (
    <PageScaffold title={t('rm.title')} subtitle={t('rm.subtitle')} breadcrumb={breadcrumb} guidanceKey="reported-mails">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <div className="mb-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
          <Upload size={15} />
          {busy ? t('rm.uploading') : t('rm.upload')}
          <input type="file" accept=".eml,message/rfc822" onChange={upload} disabled={busy} className="hidden" />
        </label>
        <p className="mt-1.5 text-sm text-text-secondary">{t('rm.uploadHint')}</p>
      </div>

      {clusters.length > 0 && (
        <Card className="mb-6" title={t('rm.clusters')} subtitle={t('rm.clustersHint')} bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('rm.col.subject')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.cluster.domain')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.cluster.mails')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.col.reports')}</th>
                <th className="py-2 font-medium">{t('rm.cluster.score')}</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => (
                <tr key={cluster.cluster_key} className="border-b border-border">
                  <td className="py-2 pr-4">{cluster.subject || t('rm.noSubject')}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{cluster.sender_domain || '—'}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">{cluster.mails}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">{cluster.reports}</td>
                  <td className="py-2">
                    <RiskBadge level={cluster.level} size="sm" label={`${cluster.max_score}/100`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {loading ? (
        <p className="text-text-secondary">{t('common.loadingSettings')}</p>
      ) : rows.length === 0 ? (
        <p className="text-text-secondary">{t('rm.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="w-8 py-2" aria-label={t('rm.analysis')} />
                <th className="py-2 pr-4 font-medium">{t('rm.col.subject')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.col.from')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.col.reportedBy')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.col.reportedAt')}</th>
                <th className="py-2 pr-4 font-medium">{t('rm.col.reports')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((mail) => (
                <Fragment key={mail.id}>
                <tr className="border-b border-border">
                  <td className="py-2 pr-1">
                    <button
                      onClick={() => setOpenRow(openRow === mail.id ? null : mail.id)}
                      aria-expanded={openRow === mail.id}
                      aria-label={t('rm.analysis')}
                      className="text-text-secondary hover:text-accent"
                    >
                      {openRow === mail.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </td>
                  <td className="py-2 pr-4">
                    {mail.subject || <span className="text-text-secondary">{t('rm.noSubject')}</span>}
                    {mail.attachment_count > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-text-secondary">
                        <Paperclip size={12} />
                        {mail.attachment_count}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{mail.from_address}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-text-secondary">{mail.reported_by_email}</td>
                  <td className="py-2 pr-4 text-text-secondary">{new Date(mail.reported_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    {mail.report_count > 1 ? (
                      <Badge tone="danger">{t('rm.reportCount', { n: String(mail.report_count) })}</Badge>
                    ) : (
                      <span className="text-text-secondary">1</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => remove(mail)} className="text-status-danger hover:underline">
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
                {openRow === mail.id && (
                  <tr className="border-b border-border">
                    <td colSpan={7} className="py-3">
                      <MailAnalysisPanel mailId={mail.id} licensed={analysisLicensed} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageScaffold>
  )
}
