/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useI18n } from '../i18n'

export type Tier = 'business' | 'enterprise'

// Outline-Badge in der Tier-Farbe: Business = grün, Enterprise = blau.
const tierStyle: Record<Tier, string> = {
  business: 'border-green-600 text-green-600',
  enterprise: 'border-blue-600 text-blue-600',
}

/** Einheitlicher Lizenz-Badge (Outline) für Business-/Enterprise-Funktionen. */
export default function TierBadge({ tier, className = '' }: { tier: Tier; className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-transparent px-1.5 py-px text-[9px] font-semibold uppercase leading-normal tracking-tight ${tierStyle[tier]} ${className}`}
    >
      {t(tier === 'enterprise' ? 'badge.enterprise' : 'badge.business')}
    </span>
  )
}
