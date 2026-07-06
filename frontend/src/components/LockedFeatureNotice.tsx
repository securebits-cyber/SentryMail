/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import TierBadge from './TierBadge'
import { useI18n } from '../i18n'

/** Sperrhinweis für eine nicht lizenzierte Funktion (z. B. LDAP = Business).
 *  Verweist auf die Lizenz-Seite. Die eigentliche Durchsetzung passiert
 *  serverseitig (403); dies ist die zugehörige UI-Hülle. */
export default function LockedFeatureNotice({ tier }: { tier: 'business' | 'enterprise' }) {
  const { t } = useI18n()
  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg text-text-secondary">
          <Lock size={18} />
        </span>
        <TierBadge tier={tier} />
      </div>
      <p className="mt-4 text-sm text-text-secondary">{t('locked.body')}</p>
      <Link
        to="/settings/license"
        className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        {t('locked.toLicense')}
      </Link>
    </div>
  )
}
