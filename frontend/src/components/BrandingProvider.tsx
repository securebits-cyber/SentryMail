/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../services/api'

export interface Branding {
  app_name: string
  accent_color: string
  accent_color_2: string
  logo_b64: string | null
}

const DEFAULT: Branding = {
  app_name: 'HumanShield.APP',
  accent_color: '#ff570a',
  accent_color_2: '#ff8a3d',
  logo_b64: null,
}

type BrandingValue = Branding & { refresh: () => void }

const BrandingContext = createContext<BrandingValue>({ ...DEFAULT, refresh: () => {} })

export function useBranding(): BrandingValue {
  return useContext(BrandingContext)
}

/** Lädt das (öffentliche) Branding und wendet Akzentfarben + Titel an.
 *  White-Label ist ein Enterprise-Feature; ohne Lizenz liefert /branding Defaults.
 *  `refresh()` lädt neu (z. B. nach dem Speichern in den Einstellungen). */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT)

  function load() {
    api
      .get<Branding>('/branding')
      .then((res) => setBranding(res.data))
      .catch(() => setBranding(DEFAULT))
  }

  useEffect(load, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-accent', branding.accent_color)
    root.style.setProperty('--color-accent-2', branding.accent_color_2)
    document.title = branding.app_name
  }, [branding])

  return <BrandingContext.Provider value={{ ...branding, refresh: load }}>{children}</BrandingContext.Provider>
}
