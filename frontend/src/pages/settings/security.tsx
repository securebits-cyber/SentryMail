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
  const [idleMinutes, setIdleMinutes] = useState<number>(0)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api
      .get<SecurityConfig>('/settings/security')
      .then((res) => {
        setValue(res.data.require_2fa)
        setIdleMinutes(res.data.idle_logout_minutes ?? 0)
      })
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/settings/security', { require_2fa: value, idle_logout_minutes: idleMinutes })
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
      guidanceKey="settings-security"
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

          <div className="mt-2 border-t border-border pt-4">
            <div className="text-sm font-medium">{t('sec.idle')}</div>
            <p className="mt-1 text-sm text-text-secondary">{t('sec.idleDesc')}</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="number"
                min={0}
                max={1440}
                value={idleMinutes}
                onChange={(e) => setIdleMinutes(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
                className="w-28 rounded-md border border-border bg-surface px-3 py-2 text-text-primary"
              />
              <span className="text-text-secondary">{t('sec.idleUnit')}</span>
            </label>
            <p className="mt-2 text-xs text-text-secondary">
              {idleMinutes === 0 ? t('sec.idleOff') : t('sec.idleOn', { minutes: String(idleMinutes) })}
            </p>
            <p className="mt-2 text-xs text-text-secondary">{t('sec.idleNote')}</p>
          </div>

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
