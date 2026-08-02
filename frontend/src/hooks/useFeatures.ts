/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { FeaturesResponse } from '../types'

/** Zustand einer Add-on-Funktion aus Sicht des UI.
 *
 *  - `loading` – /features ist noch unterwegs
 *  - `locked`  – nicht lizenziert; Schloss-Hinweis mit Verweis auf die Lizenz-Seite
 *  - `missing` – lizenziert, aber das private Paket ist im Backend nicht
 *                registriert; die zugehoerigen Endpunkte existieren nicht
 *  - `ready`   – lizenziert und installiert; die Seite darf laden
 */
export type AddonState = 'loading' | 'locked' | 'missing' | 'ready'

/** Laedt /features und meldet zusaetzlich, ob die Anfrage abgeschlossen ist.
 *
 *  `settled` ist noetig, weil ein Fehlschlag ebenfalls `null` liefert. Ohne die
 *  Unterscheidung waere "laedt noch" nicht von "Abruf fehlgeschlagen" zu
 *  trennen - und eine Seite, die auf den Ladezustand wartet, haengt dann
 *  dauerhaft. Genau dieser Fehler soll hier nicht erneut entstehen. */
export function useFeaturesResult(): { features: FeaturesResponse | null; settled: boolean } {
  const [features, setFeatures] = useState<FeaturesResponse | null>(null)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let active = true
    api
      .get<FeaturesResponse>('/features')
      .then((res) => active && setFeatures(res.data))
      .catch(() => active && setFeatures(null))
      .finally(() => active && setSettled(true))
    return () => {
      active = false
    }
  }, [])

  return { features, settled }
}

/** Laedt die aktiven Add-on-Entitlements (/features) fuer das UI-Gating. */
export function useFeatures() {
  return useFeaturesResult().features
}

/** Anzeigezustand eines Tiers (`business` / `enterprise`).
 *
 *  Die Entscheidung liegt bewusst an einer einzigen Stelle: Die Add-on-Seiten
 *  duplizierten die Lizenzpruefung zuvor jeweils selbst, weshalb der Fall
 *  "lizenziert, aber nicht installiert" in keiner von ihnen behandelt war.
 *
 *  Ist der Abruf fehlgeschlagen, gilt weiterhin `locked` - dasselbe Verhalten
 *  wie bisher. Ein fehlgeschlagenes /features bedeutet in aller Regel eine
 *  abgelaufene Sitzung oder ein nicht erreichbares Backend; das behandelt die
 *  App-Huelle, nicht die einzelne Einstellungsseite. */
export function useAddonState(tier: string): AddonState {
  const { features, settled } = useFeaturesResult()
  return addonStateFrom(features, settled, tier)
}

/** Reine Variante von {@link useAddonState}.
 *
 *  Fuer Seiten, die zwei Tiers gleichzeitig auswerten (z. B. gemeldete Mails:
 *  Meldeweg = Business, Auswertung = Enterprise) - sie holen /features einmal
 *  und leiten beide Zustaende daraus ab, statt zweimal abzurufen. */
export function addonStateFrom(
  features: FeaturesResponse | null,
  settled: boolean,
  tier: string,
): AddonState {
  if (!settled) return 'loading'
  if (!features?.features?.[tier]) return 'locked'
  // `installed` fehlt bei einem aelteren Backend, das das Feld noch nicht
  // liefert. Dann bleibt es beim alten Verhalten (nur Lizenz auswerten).
  if (features.installed && features.installed[tier] === false) return 'missing'
  return 'ready'
}
