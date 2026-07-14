/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Lock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import TierBadge, { type Tier } from './TierBadge'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'

interface AiGenerateBarProps<T> {
  endpoint: string
  onResult: (data: T) => void
  placeholder?: string
  // Benoetigtes Add-on. E-Mail-Vorlagen sind Business, Landing-Pages Enterprise.
  tier?: Tier
}

/** Kompakte Leiste „Mit KI erstellen": Kurzbeschreibung + Button, ruft einen
 *  Generierungs-Endpunkt (Add-on) und reicht das Ergebnis nach oben. Nur mit
 *  passender Lizenz nutzbar; ist die KI nicht konfiguriert, kommt eine Meldung. */
export default function AiGenerateBar<T>({ endpoint, onResult, placeholder, tier = 'business' }: AiGenerateBarProps<T>) {
  const { t, lang } = useI18n()
  const features = useFeatures()
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // KI-Erstellung ist ein kostenpflichtiges Feature: ohne Lizenz sichtbar, aber gesperrt.
  if (!features?.features?.[tier]) {
    return (
      <div className="rounded-lg border border-border bg-bg/40 p-3">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium text-text-secondary">
          <Sparkles size={15} />
          {t('ai.gen.heading')}
          <TierBadge tier={tier} />
          <Lock size={12} />
        </div>
        <p className="text-xs text-text-secondary">{t('ai.gen.locked')}</p>
      </div>
    )
  }

  async function run() {
    if (!brief.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<T>(endpoint, { brief: brief.trim(), language: lang })
      onResult(res.data)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || t('ai.gen.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-accent">
        <Sparkles size={15} />
        {t('ai.gen.heading')}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              run()
            }
          }}
          placeholder={placeholder || t('ai.gen.placeholder')}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !brief.trim()}
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? t('ai.gen.busy') : t('ai.gen.button')}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-status-danger">{error}</p>}
    </div>
  )
}
