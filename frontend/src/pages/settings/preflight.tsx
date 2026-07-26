/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ListChecks, Settings, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { useI18n } from '../../i18n'
import { useMe } from '../../hooks/useMe'
import { api } from '../../services/api'
import type { BlackoutWindow, PreflightConfig, RiskThemeClass } from '../../types'

/** Regeln des Blast-Radius-Preflights (Welle 9.2).
 *
 * Alle Vorgaben sind so gewählt, dass ein Update das Verhalten bestehender
 * Installationen nicht ändert: Ruhezeiten aus, Cooldown 30 Tage.
 */
export default function PreflightSettingsPage() {
  const { t, lang } = useI18n()
  const me = useMe()
  const readOnly = me?.role !== 'admin'

  const [config, setConfig] = useState<PreflightConfig | null>(null)
  const [themes, setThemes] = useState<RiskThemeClass[]>([])
  const [windows, setWindows] = useState<BlackoutWindow[]>([])
  const [draft, setDraft] = useState({ label: '', starts_at: '', ends_at: '' })
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const pick = (v: { de: string; en: string }) => (lang === 'en' ? v.en : v.de)

  useEffect(() => {
    api.get<PreflightConfig>('/preflight/config').then((r) => setConfig(r.data)).catch(() => undefined)
    api.get<{ classes: RiskThemeClass[] }>('/preflight/risk-themes').then((r) => setThemes(r.data.classes)).catch(() => undefined)
    loadWindows()
  }, [])

  function loadWindows() {
    api.get<BlackoutWindow[]>('/preflight/blackouts').then((r) => setWindows(r.data)).catch(() => undefined)
  }

  async function save() {
    if (!config) return
    setMessage(null)
    try {
      const res = await api.put<PreflightConfig>('/preflight/config', config)
      setConfig(res.data)
      setMessage({ kind: 'info', text: t('pf.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('pf.err.save') })
    }
  }

  async function addWindow() {
    setMessage(null)
    try {
      await api.post('/preflight/blackouts', {
        label: draft.label,
        starts_at: new Date(draft.starts_at).toISOString(),
        ends_at: new Date(draft.ends_at).toISOString(),
      })
      setDraft({ label: '', starts_at: '', ends_at: '' })
      loadWindows()
    } catch {
      setMessage({ kind: 'error', text: t('pf.err.window') })
    }
  }

  async function removeWindow(id: string) {
    await api.delete(`/preflight/blackouts/${id}`)
    loadWindows()
  }

  // Ruhezeiten sind entweder ganz an oder ganz aus - ein halbes Fenster greift
  // beim Prüfen nie und wird vom Backend abgelehnt.
  const quietOn = Boolean(config?.quiet_hours_start && config?.quiet_hours_end)

  return (
    <PageScaffold
      title={t('settings.preflight')}
      subtitle={t('pf.subtitle')}
      breadcrumb={[
        { label: t('nav.settings'), icon: Settings },
        { label: t('settings.preflight'), icon: ListChecks },
      ]}
      guidanceKey="settings-preflight"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {!config ? (
        <p className="text-text-secondary">{t('common.loadingSettings')}</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4">
          {readOnly && (
            <p className="rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">
              {t('pf.readOnly')}
            </p>
          )}

          {/* Ruhezeiten */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <label className="flex cursor-pointer gap-3">
              <input
                type="checkbox"
                checked={quietOn}
                disabled={readOnly}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev
                      ? {
                          ...prev,
                          quiet_hours_start: e.target.checked ? '22:00:00' : null,
                          quiet_hours_end: e.target.checked ? '06:00:00' : null,
                        }
                      : prev,
                  )
                }
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="block text-sm font-medium">{t('pf.quiet.label')}</span>
                <span className="block text-sm text-text-secondary">{t('pf.quiet.desc')}</span>
              </span>
            </label>

            {quietOn && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pf.quiet.from')}</span>
                  <input
                    type="time"
                    step={60}
                    value={(config.quiet_hours_start ?? '').slice(0, 5)}
                    disabled={readOnly}
                    onChange={(e) =>
                      setConfig((prev) => (prev ? { ...prev, quiet_hours_start: `${e.target.value}:00` } : prev))
                    }
                    className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pf.quiet.to')}</span>
                  <input
                    type="time"
                    step={60}
                    value={(config.quiet_hours_end ?? '').slice(0, 5)}
                    disabled={readOnly}
                    onChange={(e) =>
                      setConfig((prev) => (prev ? { ...prev, quiet_hours_end: `${e.target.value}:00` } : prev))
                    }
                    className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
                  />
                </label>
              </div>
            )}

            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pf.timezone')}</span>
              <input
                value={config.timezone}
                disabled={readOnly}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, timezone: e.target.value } : prev))}
                placeholder="Europe/Berlin"
                className="w-64 rounded-md border border-border bg-bg px-3 py-2 font-mono text-text-primary"
              />
              <span className="text-sm text-text-secondary">{t('pf.timezone.desc')}</span>
            </label>
          </div>

          {/* Cooldown */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pf.cooldown.label')}</span>
              <input
                type="number"
                min={0}
                max={3650}
                value={config.cooldown_days}
                disabled={readOnly}
                onChange={(e) =>
                  setConfig((prev) => (prev ? { ...prev, cooldown_days: Number(e.target.value) } : prev))
                }
                className="w-28 rounded-md border border-border bg-bg px-3 py-2 text-text-primary"
              />
            </label>
            <p className="mt-1.5 text-sm text-text-secondary">{t('pf.cooldown.desc')}</p>
          </div>

          {/* Zweitfreigabe */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pf.approval.label')}</span>
              <select
                value={config.second_approval_role}
                disabled={readOnly}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev ? { ...prev, second_approval_role: e.target.value as PreflightConfig['second_approval_role'] } : prev,
                  )
                }
                className="w-64 rounded-md border border-border bg-bg px-3 py-2 text-text-primary"
              >
                <option value="admin">{t('pf.approval.admin')}</option>
                <option value="privacy_officer">{t('pf.approval.officer')}</option>
              </select>
            </label>
            <p className="mt-1.5 text-sm text-text-secondary">{t('pf.approval.desc')}</p>
          </div>

          {/* Sperrfenster */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium">{t('pf.blackout.label')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('pf.blackout.desc')}</p>

            {windows.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {windows.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{w.label}</span>{' '}
                      <span className="text-text-secondary">
                        {new Date(w.starts_at).toLocaleString()} – {new Date(w.ends_at).toLocaleString()}
                      </span>
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => removeWindow(w.id)}
                        aria-label={t('common.delete')}
                        className="shrink-0 text-text-secondary hover:text-status-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!readOnly && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <input
                  value={draft.label}
                  onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder={t('pf.blackout.labelPlaceholder')}
                  className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                />
                <input
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft((prev) => ({ ...prev, starts_at: e.target.value }))}
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                />
                <input
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft((prev) => ({ ...prev, ends_at: e.target.value }))}
                  className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                />
                <button
                  onClick={addWindow}
                  disabled={!draft.label || !draft.starts_at || !draft.ends_at}
                  className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                >
                  {t('pf.blackout.add')}
                </button>
              </div>
            )}
          </div>

          {/* Risikoklassen als Nachschlagewerk */}
          {themes.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-sm font-medium">{t('pf.themes.label')}</p>
              <p className="mt-1 text-sm text-text-secondary">{t('pf.themes.desc')}</p>
              <dl className="mt-3 flex flex-col gap-3">
                {themes.map((c) => (
                  <div key={c.id}>
                    <dt className="text-sm font-medium">{pick(c.label)}</dt>
                    <dd className="text-sm text-text-secondary">{pick(c.description)}</dd>
                    <dd className="mt-1 text-sm">
                      {(lang === 'en' ? c.themes.en : c.themes.de).join(' · ')}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {!readOnly && (
            <div>
              <button onClick={save} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
                {t('common.save')}
              </button>
            </div>
          )}
        </div>
      )}
    </PageScaffold>
  )
}
