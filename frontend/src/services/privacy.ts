/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Stabiler Fehlercode aus app/services/privacy.py. */
export const INDIVIDUAL_LOCKED_CODE = 'privacy_individual_locked'

/** Ist der Fehler die Einzelpersonen-Sperre und keine fehlende Berechtigung?
 *
 * Beides ist ein 403, fuehrt aber zu voellig verschiedenen Oberflaechen: die
 * Sperre bekommt einen Erklaertext (und spaeter den Freigabe-Antrag), eine
 * fehlende Berechtigung eine Fehlermeldung. */
export function isPrivacyLocked(error: unknown): boolean {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return (detail as { code?: string } | undefined)?.code === INDIVIDUAL_LOCKED_CODE
}
