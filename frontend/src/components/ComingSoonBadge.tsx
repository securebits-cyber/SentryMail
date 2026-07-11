/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { COMING_SOON } from '../comingSoon'
import { useI18n } from '../i18n'

/** „Coming Soon"-Marker für Business-/Enterprise-Funktionen während der
 *  Vor-Launch-Phase. Rendert nichts, sobald {@link COMING_SOON} auf ``false``
 *  steht (Firmengründung abgeschlossen). Neutrales Outline-Pill, damit es
 *  nicht mit dem Ember-Akzent oder den Tier-Farben konkurriert. */
export default function ComingSoonBadge({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  if (!COMING_SOON) return null
  return (
    <span
      className={`inline-flex items-center rounded-full border border-border bg-sunken px-1.5 py-px text-[9px] font-semibold uppercase leading-normal tracking-tight text-text-secondary ${className}`}
    >
      {t('comingSoon')}
    </span>
  )
}
