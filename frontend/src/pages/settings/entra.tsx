/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Cloud, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface EntraConfig {
  enabled: boolean
  tenant_id: string
  client_id: string
  has_client_secret: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function EntraSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [form, setForm] = useState<EntraConfig | null>(null)
  const [hasSecret, setHasSecret] = useState(false)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<EntraConfig>('/settings/entra').then((res) => {
      setHasSecret(res.data.has_client_secret)
      setForm(res.data)
    })
  }, [licensed])

  function set<K extends keyof EntraConfig>(key: K, value: EntraConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(): Promise<void> {
    if (!form) return
    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      tenant_id: form.tenant_id,
      client_id: form.client_id,
    }
    if (secret) payload.client_secret = secret
    await api.put('/settings/entra', payload)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await save()
      if (secret) setHasSecret(true)
      setSecret('')
      setMessage({ kind: 'info', text: t('form.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function handleTest() {
    setBusy(true)
    setMessage({ kind: 'info', text: t('form.saveTest') })
    try {
      await save()
      if (secret) setHasSecret(true)
      setSecret('')
      const res = await api.post<{ success: boolean; detail: string }>('/settings/entra/test')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.test') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.entra'), icon: Cloud },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('entra.title')} subtitle={t('entra.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-entra">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('entra.title')} subtitle={t('entra.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-entra">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
          <div>
            <div className="text-sm font-medium">{t('entra.enable')}</div>
            <div className="text-sm text-text-secondary">{t('entra.enableDesc')}</div>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('entra.enable')} />
        </div>

        <label className={labelClass}>
          {t('entra.tenant')}
          <input value={form.tenant_id} onChange={(e) => set('tenant_id', e.target.value)} placeholder="contoso.onmicrosoft.com" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('entra.clientId')}
          <input value={form.client_id} onChange={(e) => set('client_id', e.target.value)} className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('entra.clientSecret')} {hasSecret && <span className="text-text-secondary">{t('form.secretUnchanged')}</span>}
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={hasSecret ? '••••••••' : ''} className={fieldClass} />
        </label>

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
          <button type="button" onClick={handleTest} disabled={busy} className="rounded-full border border-border px-5 py-2.5 text-text-primary hover:bg-bg disabled:opacity-60">
            {t('form.test')}
          </button>
        </div>
      </form>
      </Card>
    </PageScaffold>
  )
}
