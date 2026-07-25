/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, Copy, RefreshCw, Settings, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { ScimConfig } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'

export default function ScimSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [config, setConfig] = useState<ScimConfig | null>(null)
  // Nur direkt nach dem Erzeugen bekannt: danach liegt das Token verschlüsselt
  // in der Datenbank und wird nie wieder ausgegeben.
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const baseUrl = `${window.location.origin}/scim/v2`

  useEffect(() => {
    if (!licensed) return
    api.get<ScimConfig>('/settings/scim').then((res) => setConfig(res.data))
  }, [licensed])

  async function toggle(enabled: boolean) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<ScimConfig>('/settings/scim', { enabled })
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
      const res = await api.post<{ token: string }>('/settings/scim/token')
      setFreshToken(res.data.token)
      const state = await api.get<ScimConfig>('/settings/scim')
      setConfig(state.data)
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
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
    { label: t('settings.scim'), icon: Users },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('scim.title')} subtitle={t('scim.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-scim">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )
  if (!config) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('scim.title')} subtitle={t('scim.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-scim">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
            <div>
              <div className="text-sm font-medium">{t('scim.enable')}</div>
              <div className="text-sm text-text-secondary">{t('scim.enableDesc')}</div>
            </div>
            <Toggle
              checked={config.enabled}
              onChange={toggle}
              disabled={busy}
              aria-label={t('scim.enable')}
            />
          </div>

          <label className="flex flex-col gap-1 text-sm">
            {t('scim.endpoint')}
            <div className="flex gap-2">
              <input readOnly value={baseUrl} className={`${fieldClass} flex-1 font-mono`} />
              <button
                type="button"
                onClick={() => copy(baseUrl)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-bg"
              >
                <Copy size={14} />
                {t('scim.copy')}
              </button>
            </div>
            <span className="text-sm text-text-secondary">{t('scim.endpointHint')}</span>
          </label>

          <div className="rounded-lg border border-border bg-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t('scim.token')}</div>
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

            {config.has_token && (
              <p className="mt-2 text-xs text-text-secondary">{t('scim.tokenRotateHint')}</p>
            )}
          </div>

          <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-secondary">{t('scim.lastSeen')}</dt>
              <dd className="font-medium">
                {config.last_seen_at ? new Date(config.last_seen_at).toLocaleString() : t('scim.never')}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t('scim.users')}</dt>
              <dd className="font-mono font-medium tabular-nums">{config.users}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t('scim.groups')}</dt>
              <dd className="font-mono font-medium tabular-nums">{config.groups}</dd>
            </div>
          </dl>

          <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
            {t('scim.readOnlyHint')}
          </p>
        </div>
      </Card>
    </PageScaffold>
  )
}
