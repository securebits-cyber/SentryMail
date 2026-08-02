/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { GraduationCap, Send, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import AddonNotice from '../../components/AddonNotice'
import Card from '../../components/Card'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useAddonState } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { LmsXapiConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function LmsXapiSettingsPage() {
  const { t } = useI18n()
  const addon = useAddonState('enterprise')
  const licensed = addon === 'ready'
  const [form, setForm] = useState<LmsXapiConfig | null>(null)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<LmsXapiConfig>('/settings/lms-xapi').then((res) => setForm(res.data))
  }, [licensed])

  function set<K extends keyof LmsXapiConfig>(key: K, value: LmsXapiConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<LmsXapiConfig>('/settings/lms-xapi', {
        ...form,
        secret: secret || undefined,
      })
      setSecret('')
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
      if (form) await api.put('/settings/lms-xapi', { ...form, secret: secret || undefined })
      const res = await api.post<{ success: boolean; detail: string }>('/settings/lms-xapi/test')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.test') })
    } finally {
      setBusy(false)
    }
  }

  async function flush() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.post<{ success: boolean; detail: string }>('/settings/lms-xapi/flush')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
      const state = await api.get<LmsXapiConfig>('/settings/lms-xapi')
      setForm(state.data)
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.lmsXapi'), icon: GraduationCap },
  ]

  if (addon === 'loading') return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold
        title={t('xapi.title')}
        subtitle={t('xapi.subtitle')}
        breadcrumb={breadcrumb}
        guidanceKey="settings-lms-xapi"
      >
        <AddonNotice tier="enterprise" state={addon === 'missing' ? 'missing' : 'locked'} />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold
      title={t('xapi.title')}
      subtitle={t('xapi.subtitle')}
      breadcrumb={breadcrumb}
      guidanceKey="settings-lms-xapi"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
            <div>
              <div className="text-sm font-medium">{t('xapi.enable')}</div>
              <div className="text-sm text-text-secondary">{t('xapi.enableDesc')}</div>
            </div>
            <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('xapi.enable')} />
          </div>

          <label className={labelClass}>
            {t('xapi.endpoint')}
            <input
              value={form.endpoint}
              onChange={(e) => set('endpoint', e.target.value)}
              placeholder="https://lrs.firma.example/xapi"
              className={`${fieldClass} font-mono`}
            />
            <span className="text-sm text-text-secondary">{t('xapi.endpointHint')}</span>
          </label>

          <label className={labelClass}>
            {t('xapi.authMode')}
            <select
              value={form.auth_mode}
              onChange={(e) => set('auth_mode', e.target.value as LmsXapiConfig['auth_mode'])}
              className={fieldClass}
            >
              <option value="basic">{t('xapi.auth.basic')}</option>
              <option value="bearer">{t('xapi.auth.bearer')}</option>
            </select>
          </label>

          {form.auth_mode === 'basic' && (
            <label className={labelClass}>
              {t('xapi.username')}
              <input
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                className={`${fieldClass} font-mono`}
              />
            </label>
          )}

          <label className={labelClass}>
            {form.auth_mode === 'bearer' ? t('xapi.token') : t('xapi.password')}
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={form.has_secret ? t('xapi.secretSet') : ''}
              className={`${fieldClass} font-mono`}
            />
          </label>

          <label className={labelClass}>
            {t('xapi.actorMode')}
            <select
              value={form.actor_mode}
              onChange={(e) => set('actor_mode', e.target.value as LmsXapiConfig['actor_mode'])}
              className={fieldClass}
            >
              <option value="account">{t('xapi.actor.account')}</option>
              <option value="mbox">{t('xapi.actor.mbox')}</option>
            </select>
            <span className="text-sm text-text-secondary">
              {form.actor_mode === 'mbox' ? t('xapi.actor.mboxHint') : t('xapi.actor.accountHint')}
            </span>
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.verify_ssl}
                onChange={(e) => set('verify_ssl', e.target.checked)}
                className="accent-accent"
              />
              {t('xapi.verifySsl')}
            </label>
            <label className={labelClass}>
              {t('xapi.timeout')}
              <input
                type="number"
                min={1}
                max={120}
                value={form.timeout_seconds}
                onChange={(e) => set('timeout_seconds', Number(e.target.value))}
                className={`${fieldClass} w-28 font-mono`}
              />
            </label>
          </div>

          <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">{t('xapi.scopeHint')}</p>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {t('common.save')}
            </button>
            <button type="button" onClick={test} disabled={busy} className="rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-60">
              {t('xapi.test')}
            </button>
          </div>
        </form>
      </Card>

      <Card className="mt-6 max-w-2xl" title={t('xapi.queue')} subtitle={t('xapi.queueHint')}>
        <div className="flex flex-col gap-3 text-sm">
          <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
            <div>
              <dt className="text-text-secondary">{t('xapi.pending')}</dt>
              <dd className="font-mono font-medium tabular-nums">{form.pending}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t('xapi.failed')}</dt>
              <dd className={`font-mono font-medium tabular-nums ${form.failed > 0 ? 'text-status-danger' : ''}`}>
                {form.failed}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t('xapi.lastSuccess')}</dt>
              <dd className="font-medium">
                {form.last_success_at ? new Date(form.last_success_at).toLocaleString() : t('scim.never')}
              </dd>
            </div>
          </dl>

          {form.last_error && <p className="text-sm text-status-danger">{form.last_error}</p>}

          <div>
            <button
              type="button"
              onClick={flush}
              disabled={busy || (form.pending === 0 && form.failed === 0)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
            >
              <Send size={14} />
              {t('xapi.flush')}
            </button>
          </div>
        </div>
      </Card>
    </PageScaffold>
  )
}
