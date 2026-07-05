/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Lock, type LucideIcon } from 'lucide-react'
import PageScaffold from './PageScaffold'

interface Props {
  title: string
  icon: LucideIcon
  tagline: string
  intro: string
  features: string[]
  breadcrumb?: { label: string; icon?: LucideIcon }[]
}

/** Platzhalterseite für ein (noch nicht aktiviertes) Enterprise-Feature. */
export default function EnterprisePlaceholder({ title, icon: Icon, tagline, intro, features, breadcrumb }: Props) {
  return (
    <PageScaffold title={title} subtitle={tagline} breadcrumb={breadcrumb}>
      <div className="max-w-2xl rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Icon size={20} />
          </span>
          <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
            Enterprise
          </span>
        </div>

        <p className="mt-4 text-sm text-text-secondary">{intro}</p>

        <ul className="mt-4 flex flex-col gap-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-text-secondary">
              <Lock size={14} className="mt-0.5 shrink-0 text-text-secondary" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-md border border-dashed border-border p-4 text-sm text-text-secondary">
          Diese Funktion ist Teil des <span className="font-medium text-text-primary">Enterprise-Pakets</span> und in
          dieser Installation nicht aktiviert.
        </div>
      </div>
    </PageScaffold>
  )
}
