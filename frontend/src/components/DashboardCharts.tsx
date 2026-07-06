/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'

export interface Summary {
  campaigns: number
  recipients: number
  sent: number
  opened: number
  clicked: number
  submitted: number
}

export interface RiskSummary {
  score: number
  level: 'high' | 'medium' | 'low'
  recipients: number
  distribution: { high: number; medium: number; low: number; none: number }
  per_campaign: { campaign_id: string; name: string; recipients: number; score: number; level: string }[]
}

export interface TimelinePoint {
  date: string
  opened: number
  clicked: number
  submitted: number
}

// Status-Palette (reserviert): Ampel je Risikostufe, immer mit Icon + Label.
const RISK: Record<RiskSummary['level'], { bar: string; text: string; icon: LucideIcon; labelKey: string }> = {
  high: { bar: 'bg-status-danger', text: 'text-status-danger', icon: ShieldX, labelKey: 'risk.level.high' },
  medium: { bar: 'bg-status-warning', text: 'text-status-warning', icon: ShieldAlert, labelKey: 'risk.level.medium' },
  low: { bar: 'bg-status-success', text: 'text-status-success', icon: ShieldCheck, labelKey: 'risk.level.low' },
}

/** Risiko-Meter: Score 0–100 + Ampel + Verteilung nach Stufe. */
export function RiskMeter({ risk }: { risk: RiskSummary }) {
  const { t } = useI18n()
  const tone = RISK[risk.level]
  const Icon = tone.icon
  const bands: { key: keyof RiskSummary['distribution']; labelKey: string; dot: string }[] = [
    { key: 'high', labelKey: 'risk.band.high', dot: 'bg-status-danger' },
    { key: 'medium', labelKey: 'risk.band.medium', dot: 'bg-status-warning' },
    { key: 'low', labelKey: 'risk.band.low', dot: 'bg-status-success' },
    { key: 'none', labelKey: 'risk.band.none', dot: 'bg-border' },
  ]

  return (
    <div className="elevated rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">{t('risk.heading')}</h3>
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tone.text}`}>
          <Icon size={16} />
          {t(tone.labelKey)}
        </span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-4xl font-semibold ${tone.text}`}>{risk.score}</span>
        <span className="text-sm text-text-secondary">/ 100</span>
      </div>

      {/* Meter (Status-Farbe, gerundete Enden). aria macht den Wert zugänglich. */}
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-border/60"
        role="meter"
        aria-valuenow={risk.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('risk.heading')}
      >
        <div className={`h-3 rounded-full ${tone.bar}`} style={{ width: `${Math.max(2, risk.score)}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {bands.map((b) => (
          <div key={b.key} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.dot}`} />
            <span className="text-text-secondary">{t(b.labelKey)}</span>
            <span className="ml-auto font-mono font-medium tabular-nums">{risk.distribution[b.key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Trichter: Versendet → Geöffnet → Geklickt → Abgeschickt (Magnitude, eine Farbe). */
export function Funnel({ summary }: { summary: Summary }) {
  const { t } = useI18n()
  const base = summary.sent || summary.recipients || 0
  const stages: { key: keyof Summary; labelKey: string }[] = [
    { key: 'sent', labelKey: 'dash.tile.sent' },
    { key: 'opened', labelKey: 'dash.tile.opened' },
    { key: 'clicked', labelKey: 'dash.tile.clicked' },
    { key: 'submitted', labelKey: 'dash.tile.submitted' },
  ]

  return (
    <div className="elevated rounded-lg border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-secondary">{t('funnel.heading')}</h3>
      <div className="flex flex-col gap-3">
        {stages.map(({ key, labelKey }) => {
          const value = summary[key]
          const width = base > 0 ? Math.round((value / base) * 100) : 0
          const pct = base > 0 ? Math.round((value / base) * 100) : 0
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-text-primary">{t(labelKey)}</span>
                <span className="font-mono tabular-nums text-text-secondary">
                  {value}
                  {key !== 'sent' && base > 0 && <span className="ml-1.5 text-xs">({pct}%)</span>}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/50">
                <div className="bg-accent h-2.5 rounded-full" style={{ width: `${Math.max(value > 0 ? 3 : 0, width)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface BreakdownSlice {
  label: string
  count: number
}

export interface EngagementAnalytics {
  total_events: number
  browsers: BreakdownSlice[]
  operating_systems: BreakdownSlice[]
  devices: BreakdownSlice[]
  countries: BreakdownSlice[]
  languages: BreakdownSlice[]
  resolutions: BreakdownSlice[]
  utm_sources: BreakdownSlice[]
}

/** Eine Balkenliste (Top 6) mit Anteil je Kategorie. */
function BarList({ title, slices, total }: { title: string; slices: BreakdownSlice[]; total: number }) {
  const { t } = useI18n()
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h4>
      {slices.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('analytics.none')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {slices.slice(0, 6).map((s) => {
            const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate pr-2 text-text-primary">{s.label}</span>
                  <span className="shrink-0 font-mono tabular-nums text-text-secondary">
                    {s.count}
                    <span className="ml-1.5 text-xs">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border/50">
                  <div className="bg-accent h-2 rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Interaktions-Aufschluesselung nach Browser, OS, Geraet und UTM-Quelle. */
export function EngagementBreakdown({ analytics }: { analytics: EngagementAnalytics }) {
  const { t } = useI18n()

  return (
    <div className="elevated rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-secondary">{t('analytics.heading')}</h3>
        <span className="text-xs text-text-secondary">
          {t('analytics.basis', { count: String(analytics.total_events) })}
        </span>
      </div>
      {analytics.total_events === 0 ? (
        <p className="text-sm text-text-secondary">{t('analytics.empty')}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <BarList title={t('analytics.browsers')} slices={analytics.browsers} total={analytics.total_events} />
          <BarList title={t('analytics.os')} slices={analytics.operating_systems} total={analytics.total_events} />
          <BarList title={t('analytics.devices')} slices={analytics.devices} total={analytics.total_events} />
          <BarList title={t('analytics.countries')} slices={analytics.countries} total={analytics.total_events} />
          <BarList title={t('analytics.languages')} slices={analytics.languages} total={analytics.total_events} />
          <BarList title={t('analytics.resolutions')} slices={analytics.resolutions} total={analytics.total_events} />
          <BarList title={t('analytics.utm')} slices={analytics.utm_sources} total={analytics.total_events} />
        </div>
      )}
    </div>
  )
}

const SERIES: { key: keyof Omit<TimelinePoint, 'date'>; color: string; labelKey: string }[] = [
  { key: 'opened', color: 'var(--color-chart-opened)', labelKey: 'dash.tile.opened' },
  { key: 'clicked', color: 'var(--color-chart-clicked)', labelKey: 'dash.tile.clicked' },
  { key: 'submitted', color: 'var(--color-chart-submitted)', labelKey: 'dash.tile.submitted' },
]

/** Zeitachse: Ereignisse pro Tag (3 Serien). SVG-Linien + Legende + Tabellen-Fallback.
 *  Feste Hoehe in Pixeln — nur die Breite folgt dem Container (per ResizeObserver),
 *  damit das Diagramm auf breiten Monitoren nicht riesig mitskaliert. */
export function Timeline({ points }: { points: TimelinePoint[] }) {
  const { t } = useI18n()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const hasData = points.length > 0

  useEffect(() => {
    // Abhaengig von hasData: das div existiert erst, wenn Daten da sind.
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.max(320, el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasData])

  if (points.length === 0) {
    return (
      <div className="elevated rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-2 text-sm font-semibold text-text-secondary">{t('timeline.heading')}</h3>
        <p className="text-sm text-text-secondary">{t('timeline.empty')}</p>
      </div>
    )
  }

  const W = width
  const H = 190
  const pad = { l: 34, r: 14, t: 14, b: 30 }
  const maxY = Math.max(1, ...points.flatMap((p) => [p.opened, p.clicked, p.submitted]))
  const n = points.length
  const x = (i: number) => (n === 1 ? (pad.l + (W - pad.r)) / 2 : pad.l + (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => H - pad.b - (v / maxY) * (H - pad.t - pad.b)

  // 4 y-Gitterlinien (0..maxY)
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxY / 4) * i))
  // sparsame x-Beschriftung: erste, mittlere, letzte
  const labelIdx = new Set([0, Math.floor((n - 1) / 2), n - 1])
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="elevated rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-secondary">{t('timeline.heading')}</h3>
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {t(s.labelKey)}
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapRef}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('timeline.heading')}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(tk) + 3} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)">
              {tk}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text key={p.date} x={x(i)} y={H - pad.b + 16} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)">
              {fmtDate(p.date)}
            </text>
          ) : null,
        )}
        {SERIES.map((s) => (
          <g key={s.key}>
            {n >= 2 && (
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')}
              />
            )}
            {points.map((p, i) => (
              <circle key={p.date} cx={x(i)} cy={y(p[s.key])} r={3} fill={s.color}>
                <title>{`${fmtDate(p.date)} · ${t(s.labelKey)}: ${p[s.key]}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      </div>

      {/* Tabellen-Fallback (Barrierefreiheit / Print / forced-colors). */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-text-secondary">{t('timeline.table')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-1 pr-4 font-medium">{t('timeline.col.date')}</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-1 pr-4 font-medium">{t(s.labelKey)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-b border-border">
                  <td className="py-1 pr-4 font-mono tabular-nums">{fmtDate(p.date)}</td>
                  <td className="py-1 pr-4 font-mono tabular-nums">{p.opened}</td>
                  <td className="py-1 pr-4 font-mono tabular-nums">{p.clicked}</td>
                  <td className="py-1 pr-4 font-mono tabular-nums">{p.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
