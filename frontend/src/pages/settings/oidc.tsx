/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { KeyRound, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { OidcConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

// Passwoerter/Secrets sind write-only: leeres Feld = unveraendert lassen.
type OidcForm = Omit<OidcConfig, 'has_client_secret'> & { client_secret: string }

export default function OidcSettingsPage() {
  const { t } = useI18n()
  const [oidc, setOidc] = useState<OidcForm | null>(null)
  const [hasSecret, setHasSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api.get<OidcConfig>('/settings/oidc').then((res) => {
      const { has_client_secret, ...rest } = res.data
      setHasSecret(has_client_secret)
      setOidc({ ...rest, client_secret: '' })
    })
  }, [])

  function set<K extends keyof OidcForm>(key: K, value: OidcForm[K]) {
    setOidc((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!oidc) return
    setSaving(true)
    setMessage(null)
    try {
      const { client_secret, ...rest } = oidc
      const payload: Record<string, unknown> = { ...rest }
      if (client_secret) payload.client_secret = client_secret
      await api.put('/settings/oidc', payload)
      if (client_secret) setHasSecret(true)
      setOidc((prev) => (prev ? { ...prev, client_secret: '' } : prev))
      setMessage({ kind: 'info', text: t('oidc.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('oidc.err.save') })
    } finally {
      setSaving(false)
    }
  }

  if (!oidc) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold
      title={t('oidc.title')}
      subtitle={t('oidc.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.oidc'), icon: KeyRound },
      ]}
      guidanceKey="settings-oidc"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-4">
        <div className="elevated flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <div className="text-sm font-medium">{t('oidc.enable')}</div>
            <div className="text-sm text-text-secondary">{t('oidc.enableDesc')}</div>
          </div>
          <Toggle checked={oidc.enabled} onChange={(v) => set('enabled', v)} aria-label={t('oidc.enable')} />
        </div>

        <label className={labelClass}>
          {t('oidc.issuer')}
          <input
            value={oidc.issuer}
            onChange={(e) => set('issuer', e.target.value)}
            placeholder="https://idp.example.com/application/o/humanshield/"
            className={`${fieldClass} font-mono`}
          />
        </label>
        <label className={labelClass}>
          {t('oidc.clientId')}
          <input value={oidc.client_id} onChange={(e) => set('client_id', e.target.value)} className={`${fieldClass} font-mono`} />
        </label>
        <label className={labelClass}>
          {t('oidc.clientSecret')} {hasSecret && <span className="text-text-secondary">{t('form.secretUnchanged')}</span>}
          <input
            type="password"
            value={oidc.client_secret}
            onChange={(e) => set('client_secret', e.target.value)}
            placeholder={hasSecret ? '••••••••' : ''}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          {t('oidc.redirectUri')}
          <input
            value={oidc.redirect_uri}
            onChange={(e) => set('redirect_uri', e.target.value)}
            placeholder="https://deine-domain/api/auth/callback"
            className={`${fieldClass} font-mono`}
          />
        </label>

        <div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </PageScaffold>
  )
}
