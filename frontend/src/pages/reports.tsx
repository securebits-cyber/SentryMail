/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Download, FileText, Lock, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import { RiskMeter, type RiskSummary } from '../components/DashboardCharts'
import PageScaffold from '../components/PageScaffold'
import RiskBadge from '../components/RiskBadge'
import StatCard, { type StatTone } from '../components/StatCard'
import TierBadge from '../components/TierBadge'
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

interface TrendRow {
  campaign_id: string
  name: string
  date: string
  recipients: number
  click_rate: number
  submit_rate: number
  risk_score: number
  risk_level: 'high' | 'medium' | 'low'
}

interface UserRow {
  email: string
  campaigns: number
  opened: number
  clicked: number
  submitted: number
  risk_score: number
  risk_level: 'high' | 'medium' | 'low'
}

interface DepartmentRow {
  department: string
  recipients: number
  clicked: number
  submitted: number
  click_rate: number
  submit_rate: number
  high_criticality: number
  risk_score: number
  risk_level: 'high' | 'medium' | 'low'
}

interface Progress {
  email: string
  campaigns: number
  first_risk: number
  last_risk: number
  avg_risk: number
  trend: number
  cert_status: string
}

interface AiScoring {
  assessment: string
  recommendations: string[]
}

export default function ReportsPage() {
  const { t, lang } = useI18n()
  const features = useFeatures()
  const businessLicensed = Boolean(features?.features?.business)
  const enterpriseLicensed = Boolean(features?.features?.enterprise)
  const [aiScore, setAiScore] = useState<AiScoring | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Report>('/reports/management')
      .then((r) => setReport(r.data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Business-Reporting (Trend, Benutzerentwicklung) — nur mit Business-Lizenz.
    if (!businessLicensed) return
    api.get<TrendRow[]>('/reports/trend').then((r) => setTrend(r.data)).catch(() => setTrend([]))
    api.get<UserRow[]>('/reports/users').then((r) => setUsers(r.data)).catch(() => setUsers([]))
    api.get<DepartmentRow[]>('/reports/departments').then((r) => setDepartments(r.data)).catch(() => setDepartments([]))
  }, [businessLicensed])

  useEffect(() => {
    // Enterprise-Reporting (Schulungsfortschritt, Zertifikatsstatus) — nur mit Enterprise-Lizenz.
    if (!enterpriseLicensed) return
    api.get<Progress[]>('/enterprise-reports/users').then((r) => setProgress(r.data)).catch(() => setProgress([]))
  }, [enterpriseLicensed])

  async function runAiScoring() {
    setAiBusy(true)
    setAiError(null)
    try {
      const res = await api.post<AiScoring>('/enterprise-reports/ai-scoring', null, { params: { lang } })
      setAiScore(res.data)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setAiError(detail || t('rep.ai.error'))
    } finally {
      setAiBusy(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      await downloadBlob('/reports/management/export', 'management_report.csv')
    } finally {
      setExporting(false)
    }
  }

  async function exportPdf() {
    if (!businessLicensed) {
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

  async function exportExecutivePdf() {
    if (!businessLicensed) {
      setError(t('locked.body'))
      return
    }
    setExporting(true)
    try {
      await downloadBlob('/reports/executive/pdf', 'executive_report.pdf')
    } finally {
      setExporting(false)
    }
  }

  async function exportBusinessPdf(path: string, filename: string) {
    if (!businessLicensed) {
      setError(t('locked.body'))
      return
    }
    setExporting(true)
    try {
      await downloadBlob(path, filename)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!report) return <p className="text-text-secondary">{t('rep.empty')}</p>

  const rates: { key: keyof Report; labelKey: string; rateKey: keyof Report; tone: StatTone }[] = [
    { key: 'opened', labelKey: 'dash.tile.opened', rateKey: 'open_rate', tone: 'neutral' },
    { key: 'clicked', labelKey: 'dash.tile.clicked', rateKey: 'click_rate', tone: 'warning' },
    { key: 'submitted', labelKey: 'dash.tile.submitted', rateKey: 'submit_rate', tone: 'danger' },
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
      guidanceKey="reports"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
          >
            <Download size={15} />
            {t('rep.export')}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
          >
            <FileText size={15} />
            {t('rep.exportPdf')}
            <TierBadge tier="business" locked={!businessLicensed} />
            {!businessLicensed && <Lock size={13} className="text-text-secondary" />}
          </button>
          <button
            onClick={exportExecutivePdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
          >
            <FileText size={15} />
            {t('rep.exportExec')}
            <TierBadge tier="business" locked={!businessLicensed} />
            {!businessLicensed && <Lock size={13} className="text-text-secondary" />}
          </button>
        </div>
      }
    >
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}
      {/* Kennzahlen + Raten */}
      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard label={t('dash.tile.recipients')} value={report.recipients} />
        <StatCard label={t('dash.tile.sent')} value={report.sent} tone="accent" />
        {rates.map((r) => (
          <StatCard
            key={r.key}
            label={t(r.labelKey)}
            value={report[r.key] as number}
            tone={r.tone}
            hint={`${report[r.rateKey] as number}%`}
          />
        ))}
      </div>

      <div className="mb-6 max-w-xl">
        <RiskMeter risk={riskForMeter} />
      </div>

      {/* Enterprise: KI-gestützte Risikoanalyse (AI-Scoring) — hervorgehoben über dem Kampagnenvergleich */}
      {enterpriseLicensed && (
        <div className="mb-8 rounded-xl border border-accent/40 bg-accent/5 p-5 ring-1 ring-accent/10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles size={18} className="text-accent" />
              {t('rep.ai.heading')}
            </h2>
            <button
              onClick={runAiScoring}
              disabled={aiBusy}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {aiBusy ? t('rep.ai.busy') : t('rep.ai.run')}
            </button>
          </div>
          <p className="mb-3 max-w-3xl text-sm text-text-secondary">{t('rep.ai.intro')}</p>
          {aiError && <p className="mb-3 text-sm text-status-danger">{aiError}</p>}
          {aiScore && (
            <div className="elevated rounded-lg border border-border bg-surface p-5">
              <p className="text-sm text-text-primary">{aiScore.assessment}</p>
              {aiScore.recommendations.length > 0 && (
                <>
                  <h3 className="mb-2 mt-4 text-sm font-semibold text-text-secondary">{t('rep.ai.recommendations')}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-primary">
                    {aiScore.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Kampagnenvergleich */}
      <Card className="mb-8" title={t('rep.campaigns.heading')} bodyClassName={report.campaign_rows.length ? 'overflow-x-auto' : ''}>
        {report.campaign_rows.length === 0 ? (
        <p className="text-text-secondary">{t('rep.campaigns.empty')}</p>
      ) : (
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
                  <td className="py-2 pr-4">
                    <RiskBadge level={c.risk_level} size="sm" label={`${c.risk_score} · ${t(`risk.level.${c.risk_level}`)}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      )}
      </Card>

      {/* Top Durchgefallene */}
      <Card className="mb-8" title={t('rep.topFailed.heading')} bodyClassName={report.top_failed.length ? 'overflow-x-auto' : ''}>
        {report.top_failed.length === 0 ? (
        <p className="text-text-secondary">{t('dash.failed.empty')}</p>
      ) : (
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
      )}
      </Card>

      {/* Business: Trendanalyse */}
      {trend.length > 0 && (
        <Card
          className="mt-8"
          title={<>{t('rep.trend.heading')}<TierBadge tier="business" locked={!businessLicensed} className="ml-2 align-middle" /></>}
          bodyClassName="overflow-x-auto"
        >
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="py-2 pr-4 font-medium">{t('rep.col.campaign')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rep.trend.date')}</th>
                  <th className="py-2 pr-4 font-medium">{t('dash.tile.clicked')}</th>
                  <th className="py-2 font-medium">{t('rep.col.risk')}</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => (
                  <tr key={row.campaign_id} className="border-b border-border">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{row.date}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{row.click_rate}%</td>
                    <td className="py-2">
                      <RiskBadge level={row.risk_level} size="sm" label={`${row.risk_score} · ${t(`risk.level.${row.risk_level}`)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </Card>
      )}

      {/* Business: Benutzerentwicklung */}
      {users.length > 0 && (
        <Card
          className="mt-8"
          title={<>{t('rep.users.heading')}<TierBadge tier="business" locked={!businessLicensed} className="ml-2 align-middle" /></>}
          bodyClassName="overflow-x-auto"
        >
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rep.col.campaigns')}</th>
                  <th className="py-2 pr-4 font-medium">{t('dash.tile.clicked')}</th>
                  <th className="py-2 pr-4 font-medium">{t('dash.tile.submitted')}</th>
                  <th className="py-2 font-medium">{t('rep.col.risk')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} className="border-b border-border">
                    <td className="py-2 pr-4 font-mono">{u.email}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{u.campaigns}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{u.clicked}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{u.submitted}</td>
                    <td className="py-2">
                      <RiskBadge level={u.risk_level} size="sm" label={`${u.risk_score} · ${t(`risk.level.${u.risk_level}`)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </Card>
      )}
      {/* Business: Abteilungsvergleich */}
      {departments.length > 0 && (
        <Card
          className="mt-8"
          title={<>{t('rep.dept.heading')}<TierBadge tier="business" locked={!businessLicensed} className="ml-2 align-middle" /></>}
          bodyClassName="overflow-x-auto"
        >
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="py-2 pr-4 font-medium">{t('rep.dept.department')}</th>
                  <th className="py-2 pr-4 font-medium">{t('common.recipients')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rep.col.clickRate')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rep.col.submitRate')}</th>
                  <th className="py-2 pr-4 font-medium">{t('rep.dept.critical')}</th>
                  <th className="py-2 font-medium">{t('rep.col.risk')}</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.department} className="border-b border-border">
                    <td className="py-2 pr-4">{d.department}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{d.recipients}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{d.click_rate}%</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{d.submit_rate}%</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{d.high_criticality}</td>
                    <td className="py-2">
                      <RiskBadge level={d.risk_level} size="sm" label={`${d.risk_score} · ${t(`risk.level.${d.risk_level}`)}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </Card>
      )}
      {/* Business: Nachweise & Zertifikate */}
      <Card
        className="mt-8"
        title={<>{t('rep.evidence.heading')}<TierBadge tier="business" locked={!businessLicensed} className="ml-2 align-middle" /></>}
      >
        <div className="flex flex-wrap gap-2">
          {(['dsgvo', 'nis2', 'iso27001', 'awareness', 'audit', 'certificate', 'training'] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => exportBusinessPdf(`/reports/evidence/${kind}/pdf`, `${kind}.pdf`)}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
            >
              <FileText size={14} />
              {t(`rep.evidence.${kind}`)}
              {!businessLicensed && <Lock size={12} className="text-text-secondary" />}
            </button>
          ))}
        </div>
      </Card>

      {/* Enterprise: Schulungsfortschritt & Zertifikatsstatus */}
      {enterpriseLicensed && (
        <Card
          className="mt-8"
          title={<>{t('rep.progress.heading')}<TierBadge tier="enterprise" locked={!enterpriseLicensed} className="ml-2 align-middle" /></>}
          bodyClassName={progress.length ? 'overflow-x-auto' : ''}
        >
          {progress.length === 0 ? (
            <p className="text-text-secondary">{t('rep.progress.empty')}</p>
          ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="py-2 pr-4 font-medium">{t('rep.progress.user')}</th>
                    <th className="py-2 pr-4 font-medium">{t('rep.progress.campaigns')}</th>
                    <th className="py-2 pr-4 font-medium">{t('rep.progress.risk')}</th>
                    <th className="py-2 pr-4 font-medium">{t('rep.progress.status')}</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {progress.map((p) => (
                    <tr key={p.email} className="border-b border-border">
                      <td className="py-2 pr-4">{p.email}</td>
                      <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{p.campaigns}</td>
                      <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{p.first_risk} → {p.last_risk}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.cert_status === 'passed' ? 'bg-green-600/15 text-green-700 dark:text-green-400' : 'bg-status-danger/15 text-status-danger'}`}>
                          {t(`rep.progress.${p.cert_status}`)}
                        </span>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button onClick={() => downloadBlob(`/enterprise-reports/user/${encodeURIComponent(p.email)}/pdf`, 'bericht.pdf')} className="mr-3 text-accent hover:underline">
                          {t('rep.progress.report')}
                        </button>
                        <button onClick={() => downloadBlob(`/enterprise-reports/user/${encodeURIComponent(p.email)}/certificate/pdf`, 'zertifikat.pdf')} className="text-accent hover:underline">
                          {t('rep.progress.cert')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          )}
        </Card>
      )}

    </PageScaffold>
  )
}
