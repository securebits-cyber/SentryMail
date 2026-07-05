import { FormEvent, useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { api } from '../../services/api'
import type { LicenseStatus } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'

const statusMeta: Record<string, { label: string; tone: string }> = {
  active: { label: 'Aktiv', tone: 'text-green-600' },
  grace: { label: 'Grace-Period (Server nicht erreichbar)', tone: 'text-amber-600' },
  unreachable: { label: 'Server nicht erreichbar', tone: 'text-amber-600' },
  expired: { label: 'Abgelaufen', tone: 'text-red-600' },
  revoked: { label: 'Widerrufen', tone: 'text-red-600' },
  error: { label: 'Fehler bei der Prüfung', tone: 'text-red-600' },
  no_license: { label: 'Keine Lizenz (Open-Core)', tone: 'text-text-secondary' },
}

const featureLabels: Record<string, string> = {
  white_label: 'White-Label',
  multi_tenant: 'Multi-Tenant',
  ai_scoring: 'AI-Scoring',
}

function fmt(value: string | null): string {
  return value ? new Date(value).toLocaleString('de-DE') : '—'
}

export default function LicenseSettingsPage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function load() {
    api
      .get<LicenseStatus>('/license')
      .then((res) => setStatus(res.data))
      .catch((err) => {
        if (err?.response?.status === 403) {
          setMessage({ kind: 'error', text: 'Nur Administratoren können die Lizenz verwalten.' })
        } else {
          setMessage({ kind: 'error', text: 'Lizenzstatus konnte nicht geladen werden.' })
        }
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
      setMessage({ kind: 'info', text: 'Lizenzschlüssel gespeichert und geprüft.' })
    } catch {
      setMessage({ kind: 'error', text: 'Speichern fehlgeschlagen.' })
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
      setMessage({ kind: 'info', text: 'Lizenz neu geprüft.' })
    } catch {
      setMessage({ kind: 'error', text: 'Prüfung fehlgeschlagen.' })
    } finally {
      setBusy(false)
    }
  }

  const meta = status ? statusMeta[status.status] ?? { label: status.status, tone: 'text-text-secondary' } : null

  return (
    <PageScaffold title="Lizenz">
      <div className="flex max-w-2xl flex-col gap-6">
        {message && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              message.kind === 'error'
                ? 'border-red-600/40 text-red-600'
                : 'border-green-600/40 text-green-600'
            }`}
          >
            {message.text}
          </div>
        )}

        {status && (
          <>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-text-secondary">Status</span>
                <span className={`text-sm font-semibold ${meta?.tone}`}>{meta?.label}</span>
              </div>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-text-secondary">Kunde</dt>
                <dd>{status.customer ?? '—'}</dd>
                <dt className="text-text-secondary">Vertragsende</dt>
                <dd>{fmt(status.license_expires)}</dd>
                <dt className="text-text-secondary">Grace bis</dt>
                <dd>{fmt(status.expires_at)}</dd>
                <dt className="text-text-secondary">Letzte Prüfung</dt>
                <dd>{fmt(status.last_checked_at)}</dd>
                <dt className="text-text-secondary">Instanz-ID</dt>
                <dd className="truncate font-mono text-xs">{status.instance_id}</dd>
                <dt className="text-text-secondary">Lizenzserver</dt>
                <dd>{status.server_configured ? 'konfiguriert' : 'nicht konfiguriert'}</dd>
              </dl>
              <div className="mt-4">
                <div className="mb-1 text-sm text-text-secondary">Freigeschaltete Add-ons</div>
                {status.features.length === 0 ? (
                  <span className="text-sm text-text-secondary">keine</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {status.features.map((f) => (
                      <span key={f} className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                        {featureLabels[f] ?? f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!status.server_configured && (
              <p className="text-sm text-text-secondary">
                Es ist kein Lizenzserver konfiguriert (<code>LICENSE_SERVER_URL</code> in der <code>.env</code>). Ohne
                Lizenzserver läuft die Instanz als reiner Open-Core ohne Add-ons.
              </p>
            )}

            <form onSubmit={saveKey} className="flex flex-col gap-2">
              <label className="text-sm" htmlFor="license-key">
                Lizenzschlüssel {status.has_key && <span className="text-text-secondary">(hinterlegt)</span>}
              </label>
              {status.key_from_env ? (
                <p className="text-sm text-text-secondary">
                  Der Lizenzschlüssel wird über die <code>.env</code> (<code>LICENSE_KEY</code>) verwaltet und kann hier
                  nicht überschrieben werden.
                </p>
              ) : (
                <input
                  id="license-key"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder={status.has_key ? '•••••••• (zum Ändern neu eingeben)' : 'Lizenzschlüssel einfügen'}
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
                    Speichern & prüfen
                  </button>
                )}
                <button
                  type="button"
                  onClick={refresh}
                  disabled={busy}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-50"
                >
                  Jetzt prüfen
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </PageScaffold>
  )
}
