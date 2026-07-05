import { FormEvent, useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { LicenseStatus } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'

const statusTone: Record<string, string> = {
  active: 'text-green-600',
  grace: 'text-amber-600',
  unreachable: 'text-amber-600',
  expired: 'text-red-600',
  revoked: 'text-red-600',
  error: 'text-red-600',
  no_license: 'text-text-secondary',
}

const featureLabelKeys: Record<string, string> = {
  white_label: 'integrations.whiteLabel',
  multi_tenant: 'integrations.multiTenant',
  ai_scoring: 'integrations.aiScoring',
}

function fmt(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function LicenseSettingsPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function load() {
    api
      .get<LicenseStatus>('/license')
      .then((res) => setStatus(res.data))
      .catch((err) => {
        setMessage({ kind: 'error', text: err?.response?.status === 403 ? t('lic.err.adminOnly') : t('lic.err.load') })
      })
  }

  useEffect(load, [])

  async function saveKey(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<LicenseStatus>('/license', { license_key: licenseKey })
      setStatus(res.data)
      setLicenseKey('')
      setMessage({ kind: 'info', text: t('lic.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('lic.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function refresh() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.post<LicenseStatus>('/license/refresh')
      setStatus(res.data)
      setMessage({ kind: 'info', text: t('lic.rechecked') })
    } catch {
      setMessage({ kind: 'error', text: t('lic.err.recheck') })
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = status ? t(`lic.status.${status.status}`) : ''
  const tone = status ? statusTone[status.status] ?? 'text-text-secondary' : ''

  return (
    <PageScaffold title={t('settings.license')}>
      <div className="flex max-w-2xl flex-col gap-6">
        {message && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              message.kind === 'error' ? 'border-red-600/40 text-red-600' : 'border-green-600/40 text-green-600'
            }`}
          >
            {message.text}
          </div>
        )}

        {status && (
          <>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-text-secondary">{t('lic.label.status')}</span>
                <span className={`text-sm font-semibold ${tone}`}>{statusLabel}</span>
              </div>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-text-secondary">{t('lic.label.customer')}</dt>
                <dd>{status.customer ?? '—'}</dd>
                <dt className="text-text-secondary">{t('lic.label.contractEnd')}</dt>
                <dd>{fmt(status.license_expires)}</dd>
                <dt className="text-text-secondary">{t('lic.label.graceUntil')}</dt>
                <dd>{fmt(status.expires_at)}</dd>
                <dt className="text-text-secondary">{t('lic.label.lastCheck')}</dt>
                <dd>{fmt(status.last_checked_at)}</dd>
                <dt className="text-text-secondary">{t('lic.label.instanceId')}</dt>
                <dd className="truncate font-mono text-xs">{status.instance_id}</dd>
                <dt className="text-text-secondary">{t('lic.label.server')}</dt>
                <dd>{status.server_configured ? t('lic.server.configured') : t('lic.server.notConfigured')}</dd>
              </dl>
              <div className="mt-4">
                <div className="mb-1 text-sm text-text-secondary">{t('lic.unlockedAddons')}</div>
                {status.features.length === 0 ? (
                  <span className="text-sm text-text-secondary">{t('lic.none')}</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {status.features.map((f) => (
                      <span key={f} className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                        {t(featureLabelKeys[f] ?? f)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!status.server_configured && <p className="text-sm text-text-secondary">{t('lic.noServerNote')}</p>}

            <form onSubmit={saveKey} className="flex flex-col gap-2">
              <label className="text-sm" htmlFor="license-key">
                {t('lic.keyLabel')} {status.has_key && <span className="text-text-secondary">{t('lic.keySet')}</span>}
              </label>
              {status.key_from_env ? (
                <p className="text-sm text-text-secondary">{t('lic.envNote')}</p>
              ) : (
                <input
                  id="license-key"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder={status.has_key ? t('lic.keyPlaceholderSet') : t('lic.keyPlaceholder')}
                  className={`${fieldClass} font-mono text-sm`}
                />
              )}
              <div className="flex gap-2">
                {!status.key_from_env && (
                  <button
                    type="submit"
                    disabled={busy || !licenseKey.trim()}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {t('lic.saveCheck')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={refresh}
                  disabled={busy}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-50"
                >
                  {t('lic.recheck')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </PageScaffold>
  )
}
