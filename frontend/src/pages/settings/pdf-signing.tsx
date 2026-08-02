/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, FileSignature, RefreshCw, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import AddonNotice from '../../components/AddonNotice'
import Card from '../../components/Card'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useAddonState } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { PdfSigningConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function PdfSigningSettingsPage() {
  const { t } = useI18n()
  const addon = useAddonState('business')
  const licensed = addon === 'ready'
  const [form, setForm] = useState<PdfSigningConfig | null>(null)
  const [commonName, setCommonName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<PdfSigningConfig>('/settings/pdf-signing').then((res) => setForm(res.data))
  }, [licensed])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<PdfSigningConfig>('/settings/pdf-signing', {
        enabled: form.enabled,
        reason: form.reason,
        location: form.location,
      })
      setForm(res.data)
      setMessage({ kind: 'info', text: t('form.saved') })
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setMessage({ kind: 'error', text: typeof detail === 'string' ? detail : t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function createCertificate() {
    if (form?.has_certificate && !window.confirm(t('sign.confirmReplace'))) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.post<PdfSigningConfig>('/settings/pdf-signing/certificate', {
        common_name: commonName.trim(),
      })
      setForm(res.data)
      setCommonName('')
      setMessage({ kind: 'info', text: t('sign.created') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.pdfSigning'), icon: FileSignature },
  ]

  if (addon === 'loading') return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold
        title={t('sign.title')}
        subtitle={t('sign.subtitle')}
        breadcrumb={breadcrumb}
        guidanceKey="settings-pdf-signing"
      >
        <AddonNotice tier="business" state={addon === 'missing' ? 'missing' : 'locked'} />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  const expired = form.valid_until ? new Date(form.valid_until) < new Date() : false

  return (
    <PageScaffold
      title={t('sign.title')}
      subtitle={t('sign.subtitle')}
      breadcrumb={breadcrumb}
      guidanceKey="settings-pdf-signing"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl" title={t('sign.certificate')}>
        <div className="flex flex-col gap-4">
          {form.has_certificate ? (
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">{t('sign.subjectLabel')}</dt>
                <dd className="font-medium">{form.subject}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">{t('sign.validUntil')}</dt>
                <dd className={`font-medium ${expired ? 'text-status-danger' : ''}`}>
                  {form.valid_until ? new Date(form.valid_until).toLocaleDateString() : '—'}
                  {expired && ` · ${t('sign.expired')}`}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-secondary">{t('sign.fingerprint')}</dt>
                <dd className="break-all font-mono text-xs">{form.fingerprint}</dd>
                <p className="mt-1 text-sm text-text-secondary">{t('sign.fingerprintHint')}</p>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-text-secondary">{t('sign.noCertificate')}</p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              {t('sign.commonName')}
              <input
                value={commonName}
                onChange={(e) => setCommonName(e.target.value)}
                placeholder={t('sign.commonNamePlaceholder')}
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={createCertificate}
              disabled={busy || !commonName.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <RefreshCw size={14} />
              {form.has_certificate ? t('sign.replace') : t('sign.create')}
            </button>
          </div>
        </div>
      </Card>

      <Card className="mt-6 max-w-2xl">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
            <div>
              <div className="text-sm font-medium">{t('sign.enable')}</div>
              <div className="text-sm text-text-secondary">{t('sign.enableDesc')}</div>
            </div>
            <Toggle
              checked={form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
              disabled={!form.has_certificate}
              aria-label={t('sign.enable')}
            />
          </div>

          <label className={labelClass}>
            {t('sign.reason')}
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder={t('sign.reasonPlaceholder')}
              className={fieldClass}
            />
          </label>

          <label className={labelClass}>
            {t('sign.location')}
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={fieldClass}
            />
          </label>

          <p className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/8 p-3 text-sm text-text-secondary">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-status-warning" />
            {t('sign.selfSignedHint')}
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
