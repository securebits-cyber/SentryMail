/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Fingerprint, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import PrivacyUnlockPanel from '../../components/PrivacyUnlockPanel'
import { useI18n } from '../../i18n'
import { useMe } from '../../hooks/useMe'
import { api } from '../../services/api'
import type { PrivacyConfig } from '../../types'

export default function PrivacySettingsPage() {
  const { t } = useI18n()
  const me = useMe()
  // Der Datenschutzbeauftragte sieht die geltende Policy, aendert sie aber nicht.
  const readOnly = me?.role !== 'admin'
  const [enabled, setEnabled] = useState(false)
  const [modeEnabled, setModeEnabled] = useState(false)
  const [kThreshold, setKThreshold] = useState(5)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api
      .get<PrivacyConfig>('/settings/privacy')
      .then((res) => {
        setEnabled(res.data.fingerprinting_enabled)
        setModeEnabled(res.data.privacy_mode_enabled)
        setKThreshold(res.data.k_anonymity_threshold)
      })
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/settings/privacy', {
        fingerprinting_enabled: enabled,
        privacy_mode_enabled: modeEnabled,
        k_anonymity_threshold: kThreshold,
      })
      setMessage({ kind: 'info', text: t('priv.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('priv.err.save') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageScaffold
      title={t('settings.privacy')}
      subtitle={t('priv.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.privacy'), icon: Fingerprint },
      ]}
      guidanceKey="settings-privacy"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {!loaded ? (
        <p className="text-text-secondary">{t('common.loadingSettings')}</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4">
          {readOnly && (
            <p className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
              {t('priv.readOnly')}
            </p>
          )}
          <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={modeEnabled}
              disabled={readOnly}
              onChange={(e) => setModeEnabled(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span>
              <span className="block text-sm font-medium">{t('priv.mode.label')}</span>
              <span className="block text-sm text-text-secondary">{t('priv.mode.desc')}</span>
            </span>
          </label>

          <div className="rounded-lg border border-border bg-surface p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('priv.k.label')}</span>
              <input
                type="number"
                min={2}
                max={1000}
                value={kThreshold}
                disabled={readOnly || !modeEnabled}
                onChange={(e) => setKThreshold(Number(e.target.value))}
                className="w-28 rounded-md border border-border bg-bg px-3 py-2 text-text-primary disabled:opacity-60"
              />
            </label>
            <p className="mt-1.5 text-sm text-text-secondary">{t('priv.k.desc')}</p>
          </div>

          <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={enabled}
              disabled={readOnly}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span>
              <span className="block text-sm font-medium">{t('priv.fp.label')}</span>
              <span className="block text-sm text-text-secondary">{t('priv.fp.desc')}</span>
            </span>
          </label>
          <p className="rounded-lg border border-status-warning/30 bg-status-warning/8 p-3 text-xs text-text-secondary">
            {t('priv.fp.legal')}
          </p>
          {!readOnly && (
            <div>
              <button onClick={save} disabled={saving} className="rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60">
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          )}

          <div className="mt-4 border-t border-border pt-6">
            <PrivacyUnlockPanel />
          </div>
        </div>
      )}
    </PageScaffold>
  )
}
