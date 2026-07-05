/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Settings, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { SecurityConfig } from '../../types'

const options = [
  { value: 'off', labelKey: 'sec.opt.off.label', descKey: 'sec.opt.off.desc' },
  { value: 'admins', labelKey: 'sec.opt.admins.label', descKey: 'sec.opt.admins.desc' },
  { value: 'all', labelKey: 'sec.opt.all.label', descKey: 'sec.opt.all.desc' },
]

export default function SecuritySettingsPage() {
  const { t } = useI18n()
  const [value, setValue] = useState<string>('off')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api
      .get<SecurityConfig>('/settings/security')
      .then((res) => setValue(res.data.require_2fa))
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/settings/security', { require_2fa: value })
      setMessage({ kind: 'info', text: t('sec.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('sec.err.save') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageScaffold
      title={t('settings.security')}
      subtitle={t('sec.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.security'), icon: ShieldCheck },
      ]}
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
          <div className="text-sm font-medium">{t('sec.2faReq')}</div>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${
                  value === opt.value ? 'border-accent bg-accent/8' : 'border-border bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="require_2fa"
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium">{t(opt.labelKey)}</span>
                  <span className="block text-sm text-text-secondary">{t(opt.descKey)}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-text-secondary">{t('sec.note')}</p>
          <div>
            <button onClick={save} disabled={saving} className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </PageScaffold>
  )
}
