/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MailCheck, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { SmtpConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

// Passwoerter/Secrets sind write-only: leeres Feld = unveraendert lassen.
type SmtpForm = Omit<SmtpConfig, 'has_password'> & { password: string }

const tlsModes = [
  { value: 'starttls', labelKey: 'smtp.tls.starttls' },
  { value: 'ssl', labelKey: 'smtp.tls.ssl' },
  { value: 'none', labelKey: 'smtp.tls.none' },
]

export default function SmtpSettingsPage() {
  const { t } = useI18n()
  const [form, setForm] = useState<SmtpForm | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api.get<SmtpConfig>('/settings/smtp').then((res) => {
      const { has_password, ...rest } = res.data
      setHasPassword(has_password)
      setForm({ ...rest, password: '' })
    })
  }, [])

  function set<K extends keyof SmtpForm>(key: K, value: SmtpForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  /** Speichert die aktuellen Werte (Passwort nur wenn eingegeben). */
  async function save(): Promise<void> {
    if (!form) return
    const { password, ...rest } = form
    const payload: Record<string, unknown> = { ...rest }
    if (password) payload.password = password
    await api.put('/settings/smtp', payload)
    if (password) setHasPassword(true)
    setForm((prev) => (prev ? { ...prev, password: '' } : prev))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await save()
      setMessage({ kind: 'info', text: t('smtp.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setMessage({ kind: 'info', text: t('form.saveTest') })
    try {
      await save() // Test nutzt die gespeicherte Config -> vorher speichern.
      const res = await api.post<{ success: boolean; detail: string }>('/settings/smtp/test')
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.test') })
    } finally {
      setTesting(false)
    }
  }

  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold
      title={t('smtp.title')}
      subtitle={t('smtp.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.smtp'), icon: MailCheck },
      ]}
      guidanceKey="settings-smtp"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-4">
        <div className="flex gap-4">
          <label className={`${labelClass} flex-1`}>
            {t('field.host')}
            <input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.example.com" className={`${fieldClass} font-mono`} />
          </label>
          <label className={`${labelClass} w-28`}>
            {t('field.port')}
            <input type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} className={`${fieldClass} font-mono`} />
          </label>
        </div>

        <div className="flex gap-4">
          <label className={`${labelClass} flex-1`}>
            {t('smtp.tlsMode')}
            <select value={form.tls_mode} onChange={(e) => set('tls_mode', e.target.value)} className={fieldClass}>
              {tlsModes.map(({ value, labelKey }) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end pb-2">
            <div className="flex items-center gap-3 text-sm">
              <Toggle checked={form.verify_ssl} onChange={(v) => set('verify_ssl', v)} aria-label={t('smtp.verifyCert')} />
              {t('smtp.verifyCert')}
            </div>
          </div>
        </div>

        <label className={labelClass}>
          {t('smtp.username')}
          <input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="noreply@example.com" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('smtp.password')} {hasPassword && <span className="text-text-secondary">{t('form.secretUnchanged')}</span>}
          <input
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder={hasPassword ? '••••••••' : ''}
            className={fieldClass}
          />
        </label>

        <div className="flex gap-4">
          <label className={`${labelClass} flex-1`}>
            {t('smtp.fromEmail')}
            <input value={form.from_email} onChange={(e) => set('from_email', e.target.value)} placeholder="noreply@example.com" className={`${fieldClass} font-mono`} />
          </label>
          <label className={`${labelClass} flex-1`}>
            {t('smtp.fromName')}
            <input value={form.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="HumanShield-Awareness" className={fieldClass} />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60">
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg disabled:opacity-60"
          >
            {testing ? t('form.testing') : t('form.test')}
          </button>
        </div>
      </form>
    </PageScaffold>
  )
}
