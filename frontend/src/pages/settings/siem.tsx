/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Settings, Share2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface SiemConfig {
  enabled: boolean
  format: string
  endpoint: string
  index: string
  has_token: boolean
}

const FORMATS = [
  { value: 'splunk', label: 'Splunk HEC' },
  { value: 'elastic', label: 'Elasticsearch' },
  { value: 'sentinel', label: 'Microsoft Sentinel' },
  { value: 'json', label: 'JSON (generisch)' },
]

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function SiemSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [form, setForm] = useState<SiemConfig | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<SiemConfig>('/settings/siem').then((res) => {
      setHasToken(res.data.has_token)
      setForm(res.data)
    })
  }, [licensed])

  function set<K extends keyof SiemConfig>(key: K, value: SiemConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(): Promise<void> {
    if (!form) return
    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      format: form.format,
      endpoint: form.endpoint,
      index: form.index,
    }
    if (token) payload.token = token
    await api.put('/settings/siem', payload)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await save()
      if (token) setHasToken(true)
      setToken('')
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
      if (token) setHasToken(true)
      setToken('')
      const res = await api.post<{ success: boolean; detail: string }>('/settings/siem/test')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.test') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.siem'), icon: Share2 },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('siem.title')} subtitle={t('siem.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-siem">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('siem.title')} subtitle={t('siem.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-siem">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
          <div>
            <div className="text-sm font-medium">{t('siem.enable')}</div>
            <div className="text-sm text-text-secondary">{t('siem.enableDesc')}</div>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('siem.enable')} />
        </div>

        <label className={labelClass}>
          {t('siem.format')}
          <select value={form.format} onChange={(e) => set('format', e.target.value)} className={fieldClass}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          {t('siem.endpoint')}
          <input value={form.endpoint} onChange={(e) => set('endpoint', e.target.value)} placeholder="https://siem.example.com:8088/services/collector" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('siem.token')} {hasToken && <span className="text-text-secondary">{t('form.secretUnchanged')}</span>}
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? '••••••••' : ''} className={fieldClass} />
        </label>

        <label className={labelClass}>
          {t('siem.index')}
          <input value={form.index} onChange={(e) => set('index', e.target.value)} placeholder="phishing" className={`${fieldClass} font-mono`} />
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
