/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Blocks, Briefcase, Building2, LayoutGrid, Lock, PackageOpen, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { tierStyles, type Tier } from '../../components/AddonPage'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'

interface AddonCard {
  tier: Tier
  to: string
  labelKey: string
  descKey: string
  icon: LucideIcon
}

const cards: AddonCard[] = [
  { tier: 'opencore', to: '/integrations/opencore', labelKey: 'integrations.openCore', descKey: 'addon.oc.tagline', icon: PackageOpen },
  { tier: 'business', to: '/integrations/business', labelKey: 'integrations.business', descKey: 'addon.biz.tagline', icon: Briefcase },
  { tier: 'enterprise', to: '/integrations/enterprise', labelKey: 'integrations.enterprise', descKey: 'addon.ent.tagline', icon: Building2 },
]

export default function IntegrationsOverviewPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const features = useFeatures()

  return (
    <PageScaffold
      title={t('nav.integrations')}
      subtitle={t('io.subtitle')}
      breadcrumb={[
        { label: t('nav.integrations'), icon: Blocks },
        { label: t('integrations.overview'), icon: LayoutGrid },
      ]}
      guidanceKey="integrations"
    >
      <div className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ tier, to, labelKey, descKey, icon: Icon }) => {
          const style = tierStyles[tier]
          const active = tier === 'opencore' ? true : Boolean(features?.features?.[tier])
          return (
            <button
              key={tier}
              onClick={() => navigate(to)}
              className="flex flex-col rounded-lg border border-border bg-surface p-5 text-left transition-colors hover:border-accent/50"
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.tint}`}>
                  <Icon size={20} />
                </span>
                <span className="text-base font-semibold text-text-primary">{t(labelKey)}</span>
                {active ? (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${style.badge}`}
                  >
                    {tier === 'opencore' ? t('addon.included') : t('addon.active')}
                  </span>
                ) : (
                  <Lock size={15} className="ml-auto text-text-secondary" />
                )}
              </div>
              <p className="mt-3 text-sm text-text-secondary">{t(descKey)}</p>
            </button>
          )
        })}
      </div>
    </PageScaffold>
  )
}
