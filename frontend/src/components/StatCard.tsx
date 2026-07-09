/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'

export type StatTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const valueColor: Record<StatTone, string> = {
  neutral: 'text-text-primary',
  accent: 'text-accent',
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
}

// Dezent getoenter Icon-Chip je nach Bedeutung.
const iconChip: Record<StatTone, string> = {
  neutral: 'bg-sunken text-text-secondary',
  accent: 'bg-accent/12 text-accent-text',
  success: 'bg-status-success/12 text-status-success',
  warning: 'bg-status-warning/12 text-status-warning',
  danger: 'bg-status-danger/12 text-status-danger',
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: LucideIcon
  tone?: StatTone
  hint?: ReactNode
}

/**
 * KPI-Kachel im HumanShield-Stil: Label + Icon-Chip oben, grosse Kennzahl
 * (Display, tabellarische Ziffern), optionaler Hinweis darunter.
 */
export default function StatCard({ label, value, icon: Icon, tone = 'neutral', hint }: StatCardProps) {
  return (
    <div className="elevated flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-text-secondary">{label}</span>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-md ${iconChip[tone]}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <span className={`text-3xl font-bold leading-none tracking-tight tabular-nums ${valueColor[tone]}`}>{value}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  )
}
