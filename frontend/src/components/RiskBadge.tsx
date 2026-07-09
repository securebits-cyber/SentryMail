/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useI18n } from '../i18n'

export type RiskLevel = 'high' | 'medium' | 'low'

// fg/bg-Klassen + Dot-Variable je Stufe. high = rot, medium = amber, low = gruen.
const MAP: Record<RiskLevel, { cls: string; dot: string; labelKey: string }> = {
  high: { cls: 'bg-status-danger/12 text-status-danger', dot: 'var(--risk-high)', labelKey: 'risk.level.high' },
  medium: { cls: 'bg-status-warning/12 text-status-warning', dot: 'var(--risk-medium)', labelKey: 'risk.level.medium' },
  low: { cls: 'bg-status-success/12 text-status-success', dot: 'var(--risk-low)', labelKey: 'risk.level.low' },
}

interface RiskBadgeProps {
  level: RiskLevel
  size?: 'sm' | 'md'
  showDot?: boolean
  /** Eigener Text statt der uebersetzten Stufenbezeichnung. */
  label?: string
}

/**
 * Domaenenspezifisches Risiko-Signal (hoch/mittel/niedrig) als Pille mit
 * leuchtendem Status-Punkt — immer Farbe + Punkt, nie nur Farbe.
 */
export default function RiskBadge({ level, size = 'md', showDot = true, label }: RiskBadgeProps) {
  const { t } = useI18n()
  const r = MAP[level]
  const dims = size === 'sm' ? 'h-[22px] px-2.5 text-xs' : 'h-7 px-3 text-[13px]'
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full font-semibold ${dims} ${r.cls}`}>
      {showDot && (
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: r.dot, boxShadow: `0 0 8px ${r.dot}` }}
        />
      )}
      {label ?? t(r.labelKey)}
    </span>
  )
}
