/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ShieldAlert, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import AddonNotice from '../../components/AddonNotice'
import Card from '../../components/Card'
import PageScaffold from '../../components/PageScaffold'
import { useAddonState } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { QuarantineConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function QuarantineSettingsPage() {
  const { t } = useI18n()
  const addon = useAddonState('enterprise')
  const licensed = addon === 'ready'
  const [form, setForm] = useState<QuarantineConfig | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api
      .get<QuarantineConfig>('/settings/quarantine')
      .then((res) => setForm(res.data))
      .catch(() => setLoadError(true))
  }, [licensed])

  function set<K extends keyof QuarantineConfig>(key: K, value: QuarantineConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<QuarantineConfig>('/settings/quarantine', {
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

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.quarantine'), icon: ShieldAlert },
  ]

  if (addon === 'loading') return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold
        title={t('quarantine.title')}
        subtitle={t('quarantine.subtitle')}
        breadcrumb={breadcrumb}
        guidanceKey="settings-quarantine"
      >
        <AddonNotice tier="enterprise" state={addon === 'missing' ? 'missing' : 'locked'} />
      </PageScaffold>
    )
  if (loadError)
    return <p className="text-status-danger">{t('common.loadFailed')}</p>
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold
      title={t('quarantine.title')}
      subtitle={t('quarantine.subtitle')}
      breadcrumb={breadcrumb}
      guidanceKey="settings-quarantine"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className={labelClass}>
            {t('quarantine.backend')}
            <select
              value={form.backend}
              onChange={(e) => set('backend', e.target.value as QuarantineConfig['backend'])}
              className={fieldClass}
            >
              <option value="">{t('quarantine.backend.off')}</option>
              <option value="graph">{t('quarantine.backend.graph')}</option>
              <option value="dovecot">{t('quarantine.backend.dovecot')}</option>
            </select>
          </label>

          {form.backend === 'graph' && (
            <>
              <label className={labelClass}>
                {t('quarantine.tenantId')}
                <input
                  value={form.tenant_id}
                  onChange={(e) => set('tenant_id', e.target.value)}
                  className={`${fieldClass} font-mono`}
                />
              </label>
              <label className={labelClass}>
                {t('quarantine.clientId')}
                <input
                  value={form.client_id}
                  onChange={(e) => set('client_id', e.target.value)}
                  className={`${fieldClass} font-mono`}
                />
              </label>
              <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
                {t('quarantine.graphHint')}
              </p>
            </>
          )}

          {form.backend === 'dovecot' && (
            <>
              <label className={labelClass}>
                {t('quarantine.doveadmUrl')}
                <input
                  value={form.doveadm_url}
                  onChange={(e) => set('doveadm_url', e.target.value)}
                  placeholder="https://mail.example.intern:8080"
                  className={`${fieldClass} font-mono`}
                />
              </label>
              <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
                {t('quarantine.dovecotHint')}
              </p>
            </>
          )}

          {form.backend !== '' && (
            <>
              <label className={labelClass}>
                {t('quarantine.secret')}
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={form.has_secret ? t('quarantine.secretSet') : ''}
                  className={`${fieldClass} font-mono`}
                />
              </label>

              <label className={labelClass}>
                {t('quarantine.folder')}
                <input
                  value={form.quarantine_folder}
                  onChange={(e) => set('quarantine_folder', e.target.value)}
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
                  {t('quarantine.verifySsl')}
                </label>
                <label className={labelClass}>
                  {t('quarantine.timeout')}
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
            </>
          )}

          <p className="rounded-lg border border-status-warning/30 bg-status-warning/8 p-3 text-sm text-text-secondary">
            {t('quarantine.moveOnlyHint')}
          </p>
          <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
            {t('quarantine.codeterminationHint')}
          </p>

          <div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      </Card>
    </PageScaffold>
  )
}
