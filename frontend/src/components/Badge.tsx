import { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent'

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-text-secondary/12 text-text-secondary',
  success: 'bg-status-success/15 text-status-success',
  warning: 'bg-status-warning/15 text-status-warning',
  danger: 'bg-status-danger/15 text-status-danger',
  accent: 'bg-accent/12 text-accent',
}

/** Kleine Status-Pille mit getöntem Hintergrund. */
export default function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  )
}
