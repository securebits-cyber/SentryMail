/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ReactNode } from 'react'

interface CardProps {
  /** Mono-Overline in ALL-CAPS (weite Laufweite, Ember). */
  eyebrow?: string
  /** Karten-Titel (15px, halbfett). */
  title?: ReactNode
  /** Dezenter Untertitel unter dem Titel. */
  subtitle?: ReactNode
  /** Aktion(en) rechts im Kartenkopf (z. B. ein Button). */
  action?: ReactNode
  /** Persistenter Ember-Rahmen fuer betonte Karten. */
  accent?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * Einheitliche Karte im HumanShield-Stil (Design/ui_kits/console): warme
 * Flaeche, Haarlinien-Rahmen, weiche Radien + Elevation. Optionaler Kopf mit
 * Eyebrow/Titel/Untertitel und rechtsbuendiger Aktion.
 */
export default function Card({
  eyebrow,
  title,
  subtitle,
  action,
  accent = false,
  className = '',
  bodyClassName = '',
  children,
}: CardProps) {
  const hasHeader = eyebrow || title || subtitle || action
  return (
    <section
      className={`elevated rounded-lg border bg-surface p-5 ${accent ? 'border-accent/40' : 'border-border'} ${className}`}
    >
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
            {title && <h3 className="text-[15px] font-semibold tracking-tight text-text-primary">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
