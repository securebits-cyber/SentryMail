/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Check, Lock, type LucideIcon } from 'lucide-react'
import PageScaffold from './PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'

export interface FeatureGroup {
  title: string
  items: string[]
}

interface Props {
  tier: 'business' | 'enterprise'
  title: string
  icon: LucideIcon
  tagline: string
  intro: string
  groups: FeatureGroup[]
  breadcrumb?: { label: string; icon?: LucideIcon }[]
}

/** Übersichtsseite eines Add-ons (Business/Enterprise): listet alle enthaltenen
 *  Funktionen und zeigt anhand des Lizenz-Entitlements, ob es aktiv ist. */
export default function AddonPage({ tier, title, icon: Icon, tagline, intro, groups, breadcrumb }: Props) {
  const { t } = useI18n()
  const features = useFeatures()
  const active = Boolean(features?.features?.[tier])

  return (
    <PageScaffold title={title} subtitle={tagline} breadcrumb={breadcrumb}>
      <div className="max-w-3xl rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/12 text-accent">
            <Icon size={20} />
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white ${
              tier === 'enterprise' ? 'bg-green-600' : 'bg-accent'
            }`}
          >
            {t(tier === 'enterprise' ? 'badge.enterprise' : 'badge.business')}
          </span>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
              active ? 'bg-green-600 text-white' : 'border border-border text-text-secondary'
            }`}
          >
            {active ? t('addon.active') : t('addon.locked')}
          </span>
        </div>

        <p className="mt-4 text-sm text-text-secondary">{intro}</p>
        {tier === 'enterprise' && (
          <p className="mt-2 text-sm font-medium text-text-primary">{t('addon.ent.includesBusiness')}</p>
        )}

        <div className="mt-6 flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">{group.title}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-text-secondary">
                    {active ? (
                      <Check size={14} className="mt-0.5 shrink-0 text-green-600" />
                    ) : (
                      <Lock size={14} className="mt-0.5 shrink-0 text-text-secondary" />
                    )}
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {!active && (
          <div className="mt-6 rounded-md border border-dashed border-border p-4 text-sm text-text-secondary">
            {t('addon.notActivated')}
          </div>
        )}
      </div>
    </PageScaffold>
  )
}
