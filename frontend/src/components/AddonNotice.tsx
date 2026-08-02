/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Lock, PackageX } from 'lucide-react'
import { Link } from 'react-router'
import TierBadge from './TierBadge'
import ComingSoonBadge from './ComingSoonBadge'
import { COMING_SOON } from '../comingSoon'
import { useI18n } from '../i18n'
import type { AddonState } from '../hooks/useFeatures'

/** Hinweisflaeche fuer eine Add-on-Funktion, die (noch) nicht nutzbar ist.
 *
 *  Zwei zu unterscheidende Faelle - sie haben verschiedene Ursachen und
 *  verschiedene Abhilfen:
 *
 *  - `locked`  – nicht lizenziert. Abhilfe liegt beim Kunden (Lizenz kaufen),
 *                deshalb der Verweis auf die Lizenz-Seite.
 *  - `missing` – lizenziert, aber das private Paket ist nicht installiert.
 *                Abhilfe liegt beim Betreiber (Paket nachinstallieren). Ein
 *                Verweis auf die Lizenz-Seite waere hier irrefuehrend: die
 *                Lizenz ist in Ordnung.
 *
 *  Die eigentliche Durchsetzung passiert serverseitig (403 ohne Lizenz); dies
 *  ist die zugehoerige UI-Huelle.
 *
 *  Vor-Launch (``COMING_SOON``): Marker „Coming Soon" statt Lizenz-Aufforderung,
 *  da die Add-ons bis zum Abschluss der Firmengruendung nicht angeboten werden.
 *  Das gilt nur fuer `locked` - `missing` setzt eine Lizenz voraus und ist
 *  damit ohnehin kein Vor-Launch-Zustand. */
export default function AddonNotice({
  tier,
  state = 'locked',
}: {
  tier: 'business' | 'enterprise'
  state?: Extract<AddonState, 'locked' | 'missing'>
}) {
  const { t } = useI18n()

  if (state === 'missing')
    return (
      <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg text-text-secondary">
            <PackageX size={18} />
          </span>
          <TierBadge tier={tier} />
        </div>
        <p className="mt-4 text-sm font-medium text-text-primary">{t('missing.title')}</p>
        <p className="mt-2 text-sm text-text-secondary">{t('missing.body')}</p>
        <p className="mt-2 text-sm text-text-secondary">{t('missing.hint')}</p>
      </div>
    )

  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg text-text-secondary">
          <Lock size={18} />
        </span>
        <TierBadge tier={tier} />
        <ComingSoonBadge />
      </div>
      <p className="mt-4 text-sm text-text-secondary">{COMING_SOON ? t('comingSoon.body') : t('locked.body')}</p>
      {!COMING_SOON && (
        <Link
          to="/settings/license"
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {t('locked.toLicense')}
        </Link>
      )}
    </div>
  )
}
