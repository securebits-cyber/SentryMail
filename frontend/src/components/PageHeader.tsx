/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Optionale Mono-Overline (ALL-CAPS, Ember) ueber dem Titel. */
  eyebrow?: string
  actions?: ReactNode
}

/** Einheitlicher Seiten-Header mit Titel, optionaler Aktion und Akzent-Linie. */
export default function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {/* Durchgehende Trennlinie mit Ember-Verlaufssegment am linken Rand. */}
      <div className="mt-3 h-0.5 w-full rounded-full bg-border">
        <div className="h-0.5 w-24 rounded-full bg-accent" />
      </div>
    </header>
  )
}
