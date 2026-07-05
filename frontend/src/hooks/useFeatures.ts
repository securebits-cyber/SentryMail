/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { FeaturesResponse } from '../types'

/** Laedt die aktiven Add-on-Entitlements (/features) fuer das UI-Gating. */
export function useFeatures() {
  const [features, setFeatures] = useState<FeaturesResponse | null>(null)

  useEffect(() => {
    api
      .get<FeaturesResponse>('/features')
      .then((res) => setFeatures(res.data))
      .catch(() => setFeatures(null))
  }, [])

  return features
}
