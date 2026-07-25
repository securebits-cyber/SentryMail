/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, Copy, Download, MousePointerClick, RefreshCw, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { ReportButtonConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'

export default function ReportButtonSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [config, setConfig] = useState<ReportButtonConfig | null>(null)
  // Nur direkt nach dem Erzeugen bekannt: danach liegt das Token verschlüsselt
  // in der Datenbank und wird nie wieder ausgegeben.
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<ReportButtonConfig>('/settings/report-button').then((res) => setConfig(res.data))
  }, [licensed])

  async function save(next: Partial<ReportButtonConfig>) {
    if (!config) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<ReportButtonConfig>('/settings/report-button', {
        enabled: config.enabled,
        allowed_domains: config.allowed_domains,
        max_reports_per_hour: config.max_reports_per_hour,
        ...next,
      })
      setConfig(res.data)
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function rotateToken() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.post<{ token: string }>('/settings/report-button/token')
      setFreshToken(res.data.token)
      const state = await api.get<ReportButtonConfig>('/settings/report-button')
      setConfig(state.data)
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function downloadManifest() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.get('/settings/report-button/outlook-manifest', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'sentrymail-outlook.xml'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setMessage({ kind: 'error', text: t('rb.err.manifest') })
    } finally {
      setBusy(false)
    }
  }

  function copy(value: string) {
    navigator.clipboard?.writeText(value)
    setMessage({ kind: 'info', text: t('scim.copied') })
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.reportButton'), icon: MousePointerClick },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold
        title={t('rb.title')}
        subtitle={t('rb.subtitle')}
        breadcrumb={breadcrumb}
        guidanceKey="settings-report-button"
      >
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )
  if (!config) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold
      title={t('rb.title')}
      subtitle={t('rb.subtitle')}
      breadcrumb={breadcrumb}
      guidanceKey="settings-report-button"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
            <div>
              <div className="text-sm font-medium">{t('rb.enable')}</div>
              <div className="text-sm text-text-secondary">{t('rb.enableDesc')}</div>
            </div>
            <Toggle
              checked={config.enabled}
              onChange={(enabled) => save({ enabled })}
              disabled={busy}
              aria-label={t('rb.enable')}
            />
          </div>

          <div className="rounded-lg border border-border bg-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t('rb.token')}</div>
                <div className="text-sm text-text-secondary">
                  {config.has_token ? t('scim.tokenSet') : t('scim.tokenMissing')}
                </div>
              </div>
              <button
                type="button"
                onClick={rotateToken}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <RefreshCw size={14} />
                {config.has_token ? t('scim.tokenRotate') : t('scim.tokenCreate')}
              </button>
            </div>

            {freshToken && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-status-warning/40 bg-status-warning/8 p-3">
                <div className="flex gap-2 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-warning" />
                  <span className="text-text-secondary">{t('scim.tokenOnce')}</span>
                </div>
                <div className="flex gap-2">
                  <input readOnly value={freshToken} className={`${fieldClass} flex-1 font-mono text-xs`} />
                  <button
                    type="button"
                    onClick={() => copy(freshToken)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
                  >
                    <Copy size={14} />
                    {t('scim.copy')}
                  </button>
                </div>
              </div>
            )}

            {config.has_token && <p className="mt-2 text-xs text-text-secondary">{t('rb.tokenRotateHint')}</p>}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            {t('rb.allowedDomains')}
            <input
              value={config.allowed_domains}
              onChange={(e) => setConfig({ ...config, allowed_domains: e.target.value })}
              onBlur={(e) => save({ allowed_domains: e.target.value })}
              placeholder="firma.example, tochter.example"
              className={`${fieldClass} font-mono`}
            />
            <span className="text-sm text-text-secondary">{t('rb.allowedDomainsHint')}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            {t('rb.rateLimit')}
            <input
              type="number"
              min={1}
              max={1000}
              value={config.max_reports_per_hour}
              onChange={(e) => setConfig({ ...config, max_reports_per_hour: Number(e.target.value) })}
              onBlur={(e) => save({ max_reports_per_hour: Number(e.target.value) })}
              className={`${fieldClass} w-32 font-mono`}
            />
            <span className="text-sm text-text-secondary">{t('rb.rateLimitHint')}</span>
          </label>

          <div>
            <dt className="text-sm text-text-secondary">{t('rb.lastSeen')}</dt>
            <dd className="text-sm font-medium">
              {config.last_seen_at ? new Date(config.last_seen_at).toLocaleString() : t('scim.never')}
            </dd>
            <p className="mt-1 text-sm text-text-secondary">{t('rb.lastSeenHint')}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-6 max-w-2xl" title={t('rb.rollout')} subtitle={t('rb.rolloutHint')}>
        <div className="flex flex-col gap-5 text-sm">
          <div>
            <div className="font-medium">{t('rb.outlook')}</div>
            <p className="mt-1 text-text-secondary">{t('rb.outlookHint')}</p>
            <button
              type="button"
              onClick={downloadManifest}
              disabled={busy || !config.enabled || !config.has_token}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
            >
              <Download size={14} />
              {t('rb.outlookManifest')}
            </button>
            {(!config.enabled || !config.has_token) && (
              <p className="mt-1 text-xs text-text-secondary">{t('rb.outlookNeedsSetup')}</p>
            )}
          </div>

          <div>
            <div className="font-medium">{t('rb.thunderbird')}</div>
            <p className="mt-1 text-text-secondary">{t('rb.thunderbirdHint')}</p>
          </div>

          <div>
            <div className="font-medium">{t('rb.vsto')}</div>
            <p className="mt-1 text-text-secondary">{t('rb.vstoHint')}</p>
          </div>
        </div>
      </Card>
    </PageScaffold>
  )
}
