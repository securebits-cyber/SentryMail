/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ShieldCheck } from 'lucide-react'
import { useI18n } from '../i18n'

/** Hinweis anstelle einer gesperrten Einzelpersonen-Auswertung.
 *
 * Bewusst nicht als leere Tabelle oder Fehlermeldung: der Auswerter soll
 * erkennen, dass Daten vorhanden, aber im Datenschutzmodus bewusst nicht
 * ausgegeben werden - und woran das liegt. */
export default function PrivacyLockNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div
      className={`flex gap-3 rounded-lg border border-border bg-bg ${compact ? 'p-3' : 'p-4'}`}
      role="status"
    >
      <ShieldCheck size={compact ? 16 : 18} className="mt-0.5 shrink-0 text-accent" />
      <div>
        <p className="text-sm font-medium text-text-primary">{t('priv.locked.title')}</p>
        <p className="mt-0.5 text-sm text-text-secondary">{t('priv.locked.desc')}</p>
      </div>
    </div>
  )
}
