/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Download, FileText, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RiskMeter, type RiskSummary } from '../components/DashboardCharts'
import PageScaffold from '../components/PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'

async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

interface CampaignRow {
  campaign_id: string
  name: string
  recipients: number
  sent: number
  opened: number
  clicked: number
  submitted: number
  open_rate: number
  click_rate: number
  submit_rate: number
  risk_score: number
  risk_level: 'high' | 'medium' | 'low'
}

interface Failed {
  email: string
  first_name: string | null
  last_name: string | null
  campaign_id: string
  campaign_name: string
  status: 'clicked' | 'submitted'
  occurred_at: string
}

interface Report {
  generated_at: string
  campaigns_total: number
  recipients: number
  sent: number
  opened: number
  clicked: number
  submitted: number
  open_rate: number
  click_rate: number
  submit_rate: number
  risk_score: number
  risk_level: 'high' | 'medium' | 'low'
  risk_distribution: { high: number; medium: number; low: number; none: number }
  campaign_rows: CampaignRow[]
  top_failed: Failed[]
}

const levelText: Record<string, string> = {
  high: 'text-status-danger',
  medium: 'text-status-warning',
  low: 'text-status-success',
}

export default function ReportsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const pdfLicensed = Boolean(features?.features?.business) // PDF-Export ist Business
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Report>('/reports/management')
      .then((r) => setReport(r.data))
      .finally(() => setLoading(false))
  }, [])

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadBlob('/reports/management/export', 'management_report.csv')
    } finally {
      setExporting(false)
    }
  }

  async function exportPdf() {
    if (!pdfLicensed) {
      setError(t('locked.body'))
      return
    }
    setExporting(true)
    try {
      await downloadBlob('/reports/management/pdf', 'management_report.pdf')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!report) return <p className="text-text-secondary">{t('rep.empty')}</p>

  const rates: { key: keyof Report; labelKey: string; rateKey: keyof Report; tone: string }[] = [
    { key: 'opened', labelKey: 'dash.tile.opened', rateKey: 'open_rate', tone: 'text-text-primary' },
    { key: 'clicked', labelKey: 'dash.tile.clicked', rateKey: 'click_rate', tone: 'text-status-warning' },
    { key: 'submitted', labelKey: 'dash.tile.submitted', rateKey: 'submit_rate', tone: 'text-status-danger' },
  ]

  const riskForMeter: RiskSummary = {
    score: report.risk_score,
    level: report.risk_level,
    recipients: report.recipients,
    distribution: report.risk_distribution,
    per_campaign: [],
  }

  return (
    <PageScaffold
      title={t('rep.title')}
      subtitle={`${t('rep.generated')}: ${new Date(report.generated_at).toLocaleString()}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
          >
            <Download size={15} />
            {t('rep.export')}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
          >
            <FileText size={15} />
            {t('rep.exportPdf')}
            <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white">
              {t('badge.business')}
            </span>
            {!pdfLicensed && <Lock size={13} className="text-text-secondary" />}
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
      {/* Kennzahlen + Raten */}
      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        <div className="elevated rounded-lg border border-border bg-surface p-4">
          <div className="text-sm text-text-secondary">{t('dash.tile.recipients')}</div>
          <div className="mt-1 font-mono text-3xl font-semibold">{report.recipients}</div>
        </div>
        <div className="elevated rounded-lg border border-border bg-surface p-4">
          <div className="text-sm text-text-secondary">{t('dash.tile.sent')}</div>
          <div className="mt-1 font-mono text-3xl font-semibold text-accent">{report.sent}</div>
        </div>
        {rates.map((r) => (
          <div key={r.key} className="elevated rounded-lg border border-border bg-surface p-4">
            <div className="text-sm text-text-secondary">{t(r.labelKey)}</div>
            <div className={`mt-1 font-mono text-3xl font-semibold ${r.tone}`}>{report[r.key] as number}</div>
            <div className="mt-0.5 text-xs text-text-secondary">{report[r.rateKey] as number}%</div>
          </div>
        ))}
      </div>

      <div className="mb-6 max-w-xl">
        <RiskMeter risk={riskForMeter} />
      </div>

      {/* Kampagnenvergleich */}
      <h2 className="mb-3 text-lg font-semibold">{t('rep.campaigns.heading')}</h2>
      {report.campaign_rows.length === 0 ? (
        <p className="mb-8 text-text-secondary">{t('rep.campaigns.empty')}</p>
      ) : (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('rep.col.campaign')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.tile.recipients')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.tile.opened')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.tile.clicked')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.tile.submitted')}</th>
                <th className="py-2 pr-4 font-medium">{t('rep.col.risk')}</th>
              </tr>
            </thead>
            <tbody>
              {report.campaign_rows.map((c) => (
                <tr key={c.campaign_id} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <Link to={`/results/${c.campaign_id}`} className="hover:text-accent hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums">{c.recipients}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">
                    {c.opened} <span className="text-xs text-text-secondary">({c.open_rate}%)</span>
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums">
                    {c.clicked} <span className="text-xs text-text-secondary">({c.click_rate}%)</span>
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums">
                    {c.submitted} <span className="text-xs text-text-secondary">({c.submit_rate}%)</span>
                  </td>
                  <td className={`py-2 pr-4 font-mono font-semibold tabular-nums ${levelText[c.risk_level]}`}>
                    {c.risk_score} · {t(`risk.level.${c.risk_level}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top Durchgefallene */}
      <h2 className="mb-3 text-lg font-semibold">{t('rep.topFailed.heading')}</h2>
      {report.top_failed.length === 0 ? (
        <p className="text-text-secondary">{t('dash.failed.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.col.campaign')}</th>
                <th className="py-2 font-medium">{t('dash.col.event')}</th>
              </tr>
            </thead>
            <tbody>
              {report.top_failed.map((f) => (
                <tr key={`${f.email}-${f.campaign_id}`} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono">{f.email}</td>
                  <td className="py-2 pr-4">{f.campaign_name}</td>
                  <td className={`py-2 font-medium ${f.status === 'submitted' ? 'text-status-danger' : 'text-status-warning'}`}>
                    {f.status === 'submitted' ? t('dash.event.submitted') : t('dash.event.clicked')}
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
