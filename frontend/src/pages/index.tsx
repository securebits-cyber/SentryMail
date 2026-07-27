/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { GraduationCap, KeyRound, Mail, MailOpen, MousePointerClick, Send, Usb, Users, type LucideIcon } from 'lucide-react'
import Badge from '../components/Badge'
import Card from '../components/Card'
import GettingStarted from '../components/GettingStarted'
import StatCard, { type StatTone } from '../components/StatCard'
import {
  ActivityHeatmapCard,
  EngagementBreakdown,
  Funnel,
  HumanRiskCard,
  RiskMeter,
  Timeline,
  type ActivityHeatmap,
  type EngagementAnalytics,
  type HumanRiskSummary,
  type MailMetrics,
  type RiskSummary,
  type Summary,
  type TimelinePoint,
} from '../components/DashboardCharts'
import PageHeader from '../components/PageHeader'
import PrivacyLockNotice from '../components/PrivacyLockNotice'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import { isPrivacyLocked } from '../services/privacy'

interface Failed {
  email: string
  first_name: string | null
  last_name: string | null
  campaign_id: string
  campaign_name: string
  status: 'clicked' | 'submitted'
  occurred_at: string
}

const tiles: { key: keyof MailMetrics; labelKey: string; tone: StatTone; icon: LucideIcon }[] = [
  { key: 'campaigns', labelKey: 'dash.tile.campaigns', tone: 'neutral', icon: Send },
  { key: 'recipients', labelKey: 'dash.tile.recipients', tone: 'neutral', icon: Users },
  { key: 'sent', labelKey: 'dash.tile.sent', tone: 'accent', icon: Mail },
  { key: 'opened', labelKey: 'dash.tile.opened', tone: 'neutral', icon: MailOpen },
  { key: 'clicked', labelKey: 'dash.tile.clicked', tone: 'warning', icon: MousePointerClick },
  { key: 'submitted', labelKey: 'dash.tile.submitted', tone: 'danger', icon: KeyRound },
]

export default function DashboardPage() {
  const { t } = useI18n()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [risk, setRisk] = useState<RiskSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [analytics, setAnalytics] = useState<EngagementAnalytics | null>(null)
  const [heatmap, setHeatmap] = useState<ActivityHeatmap | null>(null)
  const [humanRisk, setHumanRisk] = useState<HumanRiskSummary | null>(null)
  const [failed, setFailed] = useState<Failed[]>([])
  const [failedLocked, setFailedLocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<Summary>('/dashboard/summary').then((r) => setSummary(r.data)),
      api.get<RiskSummary>('/dashboard/risk').then((r) => setRisk(r.data)),
      api.get<TimelinePoint[]>('/dashboard/timeline').then((r) => setTimeline(r.data)),
      api.get<EngagementAnalytics>('/dashboard/analytics').then((r) => setAnalytics(r.data)),
      api.get<ActivityHeatmap>('/dashboard/heatmap').then((r) => setHeatmap(r.data)),
      api.get<HumanRiskSummary>('/dashboard/human-risk').then((r) => setHumanRisk(r.data)),
      // Im Datenschutzmodus antwortet der Endpunkt mit 403 - das ist kein
      // Fehler, sondern die erzwungene Sperre, und darf die uebrigen Kacheln
      // des Dashboards nicht mitreissen.
      api
        .get<Failed[]>('/dashboard/failed')
        .then((r) => setFailed(r.data))
        .catch((e) => setFailedLocked(isPrivacyLocked(e))),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-text-secondary">{t('dash.loading')}</p>

  return (
    <>
      <PageHeader title={t('nav.controlCenter')} subtitle={t('dash.subtitle')} />

      <GettingStarted campaigns={summary?.campaigns ?? 0} />

      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {tiles.map(({ key, labelKey, tone, icon }) => (
          <StatCard key={key} label={t(labelKey)} value={summary?.[key] ?? 0} tone={tone} icon={icon} />
        ))}
      </div>

      {/* USB-Drops getrennt. Sie haben weder Zustellung noch Oeffnungsrate im
          Sinne der Mail-Kennzahlen: Gezaehlt werden ausgelegte Datentraeger und
          wie viele davon geoeffnet wurden. In dieselben Kacheln gemischt waeren
          beide Zahlen unbrauchbar. */}
      {(summary?.drops.campaigns ?? 0) > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Usb size={16} />
            {t('dash.drops.title')}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            <StatCard label={t('dash.drops.campaigns')} value={summary?.drops.campaigns ?? 0} tone="neutral" icon={Usb} />
            <StatCard label={t('dash.drops.media')} value={summary?.drops.media ?? 0} tone="neutral" icon={Users} />
            <StatCard label={t('dash.drops.opened')} value={summary?.drops.opened ?? 0} tone="warning" icon={MousePointerClick} />
          </div>
          <p className="mt-3 text-xs text-text-secondary">{t('dash.drops.note')}</p>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {risk && <RiskMeter risk={risk} />}
        {summary && <Funnel summary={summary} />}
      </div>

      <div className="mb-6">
        <Timeline points={timeline} />
      </div>

      {analytics && (
        <div className="mb-6">
          <EngagementBreakdown analytics={analytics} />
        </div>
      )}

      {heatmap && (
        <div className="mb-6">
          <ActivityHeatmapCard heatmap={heatmap} />
        </div>
      )}

      {humanRisk && (
        <div className="mb-8">
          <HumanRiskCard summary={humanRisk} />
        </div>
      )}

      <Card title={t('dash.failed.heading')}>
      {failedLocked ? (
        <PrivacyLockNotice compact />
      ) : failed.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('dash.failed.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.col.campaign')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.col.event')}</th>
                <th className="py-2 pr-4 font-medium">{t('dash.col.time')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {failed.map((f) => (
                <tr key={`${f.email}-${f.campaign_id}`} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono text-sm">{f.email}</td>
                  <td className="py-2 pr-4">{[f.first_name, f.last_name].filter(Boolean).join(' ')}</td>
                  <td className="py-2 pr-4">
                    <Link to={`/results/${f.campaign_id}`} className="text-text-secondary hover:text-accent hover:underline">
                      {f.campaign_name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone={f.status === 'submitted' ? 'danger' : 'warning'}>
                      {f.status === 'submitted' ? t('dash.event.submitted') : t('dash.event.clicked')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {new Date(f.occurred_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    {/* LMS ist Enterprise: ohne Lizenz zeigt die Zielseite den Sperrhinweis. */}
                    <Link
                      to={`/lms/assignments?email=${encodeURIComponent(f.email)}`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:bg-bg"
                    >
                      <GraduationCap size={14} />
                      {t('dash.assignTraining')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </Card>
    </>
  )
}
