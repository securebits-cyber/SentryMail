/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Share2, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import AddonNotice from '../../components/AddonNotice'
import Card from '../../components/Card'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useAddonState } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { MispConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function MispSettingsPage() {
  const { t } = useI18n()
  const addon = useAddonState('enterprise')
  const licensed = addon === 'ready'
  const [form, setForm] = useState<MispConfig | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<MispConfig>('/settings/misp').then((res) => setForm(res.data))
  }, [licensed])

  function set<K extends keyof MispConfig>(key: K, value: MispConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<MispConfig>('/settings/misp', { ...form, api_key: apiKey || undefined })
      setApiKey('')
      setForm(res.data)
      setMessage({ kind: 'info', text: t('form.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMessage({ kind: 'info', text: t('form.saveTest') })
    try {
      if (form) await api.put('/settings/misp', { ...form, api_key: apiKey || undefined })
      const res = await api.post<{ success: boolean; detail: string }>('/settings/misp/test')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.test') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.misp'), icon: Share2 },
  ]

  if (addon === 'loading') return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('misp.title')} subtitle={t('misp.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-misp">
        <AddonNotice tier="enterprise" state={addon === 'missing' ? 'missing' : 'locked'} />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('misp.title')} subtitle={t('misp.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-misp">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
            <div>
              <div className="text-sm font-medium">{t('misp.enable')}</div>
              <div className="text-sm text-text-secondary">{t('misp.enableDesc')}</div>
            </div>
            <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('misp.enable')} />
          </div>

          <label className={labelClass}>
            {t('misp.url')}
            <input
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://misp.example.intern"
              className={`${fieldClass} font-mono`}
            />
          </label>

          <label className={labelClass}>
            {t('misp.apiKey')}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={form.has_api_key ? t('misp.keySet') : ''}
              className={`${fieldClass} font-mono`}
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.verify_ssl}
                onChange={(e) => set('verify_ssl', e.target.checked)}
                className="accent-accent"
              />
              {t('misp.verifySsl')}
            </label>
            <label className={labelClass}>
              {t('misp.timeout')}
              <input
                type="number"
                min={1}
                max={60}
                value={form.timeout_seconds}
                onChange={(e) => set('timeout_seconds', Number(e.target.value))}
                className={`${fieldClass} w-28 font-mono`}
              />
            </label>
          </div>

          <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">{t('misp.selfHostedHint')}</p>
          <p className="rounded-lg border border-status-warning/30 bg-status-warning/8 p-3 text-sm text-text-secondary">
            {t('misp.unavailableHint')}
          </p>

          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {t('common.save')}
            </button>
            <button type="button" onClick={test} disabled={busy} className="rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-60">
              {t('misp.test')}
            </button>
          </div>
        </form>
      </Card>
    </PageScaffold>
  )
}
