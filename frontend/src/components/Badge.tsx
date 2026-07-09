/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent'

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-text-secondary/12 text-text-secondary',
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-status-warning/15 text-status-warning',
  danger: 'bg-status-danger/15 text-status-danger',
  accent: 'bg-accent/12 text-accent-text',
}

// Punkt-Farbe je Ton (fuer die optionale, leuchtende Statusanzeige).
const dotColor: Record<BadgeTone, string> = {
  neutral: 'var(--color-text-secondary)',
  success: 'var(--color-status-success)',
  warning: 'var(--color-status-warning)',
  danger: 'var(--color-status-danger)',
  accent: 'var(--color-accent)',
}

interface BadgeProps {
  tone?: BadgeTone
  /** Leuchtender Status-Punkt links (z. B. fuer „laeuft"). */
  dot?: boolean
  children: ReactNode
}

/** Kleine Status-Pille mit getöntem Hintergrund, optional mit Glow-Punkt. */
export default function Badge({ tone = 'neutral', dot = false, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]}`}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: dotColor[tone], boxShadow: `0 0 6px ${dotColor[tone]}` }}
        />
      )}
      {children}
    </span>
  )
}
