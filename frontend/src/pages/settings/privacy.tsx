/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Fingerprint, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { PrivacyConfig } from '../../types'

export default function PrivacySettingsPage() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api
      .get<PrivacyConfig>('/settings/privacy')
      .then((res) => setEnabled(res.data.fingerprinting_enabled))
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/settings/privacy', { fingerprinting_enabled: enabled })
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
          <label className="flex cursor-pointer gap-3 rounded-lg border border-border bg-surface p-4">
            <input
              type="checkbox"
              checked={enabled}
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
          <div>
            <button onClick={save} disabled={saving} className="rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </PageScaffold>
  )
}
