/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useI18n } from '../i18n'

// Einfache, abhaengigkeitsfreie Passwort-Staerke-Heuristik (Laenge + Zeichenklassen).
// Kein Ersatz fuer serverseitige Policy — nur eine visuelle Hilfe fuer den Nutzer.
export function passwordScore(pw: string): number {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length
  if (variety >= 2) s++
  if (variety >= 3) s++
  if (pw.length < 6) s = Math.min(s, 1)
  return Math.max(1, Math.min(s, 4))
}

const meta = [
  null,
  { key: 'pwm.weak', bar: 'bg-status-danger', text: 'text-status-danger' },
  { key: 'pwm.medium', bar: 'bg-status-warning', text: 'text-status-warning' },
  { key: 'pwm.good', bar: 'bg-accent', text: 'text-accent' },
  { key: 'pwm.strong', bar: 'bg-status-success', text: 'text-status-success' },
] as const

export default function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useI18n()
  if (!password) return null
  const score = passwordScore(password)
  const m = meta[score]!
  return (
    <div className="mt-1" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? m.bar : 'bg-border'}`} />
        ))}
      </div>
      <p className={`mt-1 text-xs ${m.text}`}>
        {t('pwm.strength')}: {t(m.key)}
      </p>
    </div>
  )
}
