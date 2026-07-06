/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Settings, Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface AiConfig {
  enabled: boolean
  provider: string
  base_url: string
  model: string
  has_api_key: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function AiSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [form, setForm] = useState<AiConfig | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<AiConfig>('/settings/ai').then((res) => {
      setHasKey(res.data.has_api_key)
      setForm(res.data)
    })
  }, [licensed])

  function set<K extends keyof AiConfig>(key: K, value: AiConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(): Promise<void> {
    if (!form) return
    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      provider: form.provider,
      base_url: form.base_url,
      model: form.model,
    }
    if (apiKey) payload.api_key = apiKey
    await api.put('/settings/ai', payload)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await save()
      if (apiKey) setHasKey(true)
      setApiKey('')
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
      if (apiKey) setHasKey(true)
      setApiKey('')
      const res = await api.post<{ success: boolean; detail: string }>('/settings/ai/test')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.test') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.ai'), icon: Sparkles },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('ai.title')} subtitle={t('ai.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-ai">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('ai.title')} subtitle={t('ai.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-ai">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-4">
        <div className="elevated flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <div className="text-sm font-medium">{t('ai.enable')}</div>
            <div className="text-sm text-text-secondary">{t('ai.enableDesc')}</div>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('ai.enable')} />
        </div>

        <p className="text-xs text-text-secondary">{t('ai.hint')}</p>

        <label className={labelClass}>
          {t('ai.provider')}
          <input value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="OpenAI, Ollama, Anthropic …" className={fieldClass} />
        </label>

        <label className={labelClass}>
          {t('ai.baseUrl')}
          <input value={form.base_url} onChange={(e) => set('base_url', e.target.value)} placeholder="https://api.openai.com/v1" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('ai.model')}
          <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="gpt-4o-mini, llama3.1 …" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('ai.apiKey')} {hasKey && <span className="text-text-secondary">{t('form.secretUnchanged')}</span>}
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={hasKey ? '••••••••' : ''} className={fieldClass} />
        </label>

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
          <button type="button" onClick={handleTest} disabled={busy} className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg disabled:opacity-60">
            {t('form.test')}
          </button>
        </div>
      </form>
    </PageScaffold>
  )
}
