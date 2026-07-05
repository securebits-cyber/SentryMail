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
