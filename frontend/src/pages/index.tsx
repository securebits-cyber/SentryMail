/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, KeyRound, Mail, MailOpen, MousePointerClick, Send, Users, type LucideIcon } from 'lucide-react'
import Badge from '../components/Badge'
import Card from '../components/Card'
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
  type RiskSummary,
  type Summary,
  type TimelinePoint,
} from '../components/DashboardCharts'
import PageHeader from '../components/PageHeader'
import { useI18n } from '../i18n'
import { api } from '../services/api'

interface Failed {
  email: string
  first_name: string | null
  last_name: string | null
  campaign_id: string
  campaign_name: string
  status: 'clicked' | 'submitted'
  occurred_at: string
}

const tiles: { key: keyof Summary; labelKey: string; tone: StatTone; icon: LucideIcon }[] = [
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<Summary>('/dashboard/summary').then((r) => setSummary(r.data)),
      api.get<RiskSummary>('/dashboard/risk').then((r) => setRisk(r.data)),
      api.get<TimelinePoint[]>('/dashboard/timeline').then((r) => setTimeline(r.data)),
      api.get<EngagementAnalytics>('/dashboard/analytics').then((r) => setAnalytics(r.data)),
      api.get<ActivityHeatmap>('/dashboard/heatmap').then((r) => setHeatmap(r.data)),
      api.get<HumanRiskSummary>('/dashboard/human-risk').then((r) => setHumanRisk(r.data)),
      api.get<Failed[]>('/dashboard/failed').then((r) => setFailed(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-text-secondary">{t('dash.loading')}</p>

  return (
    <>
      <PageHeader title={t('nav.controlCenter')} subtitle={t('dash.subtitle')} />

      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {tiles.map(({ key, labelKey, tone, icon }) => (
          <StatCard key={key} label={t(labelKey)} value={summary?.[key] ?? 0} tone={tone} icon={icon} />
        ))}
      </div>

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
      {failed.length === 0 ? (
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
