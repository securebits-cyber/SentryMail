/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { KeySquare, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface SamlConfig {
  enabled: boolean
  idp_entity_id: string
  idp_sso_url: string
  idp_x509_cert: string
  sp_entity_id: string
  sp_acs_url: string
  attr_email: string
  attr_name: string
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function SamlSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [form, setForm] = useState<SamlConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<SamlConfig>('/settings/saml').then((res) => setForm(res.data))
  }, [licensed])

  function set<K extends keyof SamlConfig>(key: K, value: SamlConfig[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      await api.put('/settings/saml', form)
      setMessage({ kind: 'info', text: t('form.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.saml'), icon: KeySquare },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('saml.title')} subtitle={t('saml.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-saml">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('saml.title')} subtitle={t('saml.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-saml">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSave} className="flex max-w-2xl flex-col gap-4">
        <div className="elevated flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <div className="text-sm font-medium">{t('saml.enable')}</div>
            <div className="text-sm text-text-secondary">{t('saml.enableDesc')}</div>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('saml.enable')} />
        </div>

        <h3 className="mt-2 text-sm font-semibold text-text-secondary">{t('saml.idpSection')}</h3>

        <label className={labelClass}>
          {t('saml.idpEntityId')}
          <input value={form.idp_entity_id} onChange={(e) => set('idp_entity_id', e.target.value)} placeholder="https://idp.example.com/metadata" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('saml.idpSsoUrl')}
          <input value={form.idp_sso_url} onChange={(e) => set('idp_sso_url', e.target.value)} placeholder="https://idp.example.com/sso/redirect" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('saml.idpCert')}
          <textarea value={form.idp_x509_cert} onChange={(e) => set('idp_x509_cert', e.target.value)} rows={5} placeholder="-----BEGIN CERTIFICATE-----" className={`${fieldClass} font-mono text-xs`} />
        </label>

        <h3 className="mt-2 text-sm font-semibold text-text-secondary">{t('saml.spSection')}</h3>

        <label className={labelClass}>
          {t('saml.spEntityId')}
          <input value={form.sp_entity_id} onChange={(e) => set('sp_entity_id', e.target.value)} placeholder="https://awareness.example.com/sp" className={`${fieldClass} font-mono`} />
        </label>

        <label className={labelClass}>
          {t('saml.spAcsUrl')}
          <input value={form.sp_acs_url} onChange={(e) => set('sp_acs_url', e.target.value)} placeholder="https://awareness.example.com/auth/saml/acs" className={`${fieldClass} font-mono`} />
        </label>

        <h3 className="mt-2 text-sm font-semibold text-text-secondary">{t('saml.attrSection')}</h3>
        <p className="-mt-2 text-xs text-text-secondary">{t('saml.attrHint')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {t('saml.attrEmail')}
            <input value={form.attr_email} onChange={(e) => set('attr_email', e.target.value)} placeholder="urn:oid:0.9.2342.19200300.100.1.3" className={`${fieldClass} font-mono`} />
          </label>
          <label className={labelClass}>
            {t('saml.attrName')}
            <input value={form.attr_name} onChange={(e) => set('attr_name', e.target.value)} placeholder="displayName" className={`${fieldClass} font-mono`} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
          <a href="/auth/saml/metadata" target="_blank" rel="noreferrer" className="text-sm text-accent hover:underline">
            {t('saml.metadata')}
          </a>
        </div>
      </form>
    </PageScaffold>
  )
}
