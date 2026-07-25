/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useI18n } from '../i18n'

/**
 * Kennzeichnet eine Funktion als Beta.
 *
 * Bewusst dieselbe Outline-Form wie {@link TierBadge}, aber in Warnfarbe: Es ist
 * keine Lizenzfrage, sondern eine Reifegrad-Aussage. Wer die Funktion einsetzt,
 * soll vorher wissen, dass sie noch nicht in der Breite erprobt ist — und nicht
 * erst, wenn etwas nicht funktioniert.
 */
export default function BetaBadge({ title, className = '' }: { title?: string; className?: string }) {
  const { t } = useI18n()
  return (
    <span
      title={title ?? t('beta.hint')}
      className={`inline-flex items-center rounded-full border border-status-warning bg-transparent px-1.5 py-px text-[9px] font-semibold uppercase leading-normal tracking-tight text-status-warning ${className}`}
    >
      {t('beta')}
    </span>
  )
}
