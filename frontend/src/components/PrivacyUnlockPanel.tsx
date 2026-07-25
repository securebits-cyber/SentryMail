/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from './Badge'
import { useMe } from '../hooks/useMe'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { Campaign, PrivacyOfficer, PrivacyUnlockRequest, PrivacyUnlockStatus } from '../types'

const statusTone: Record<PrivacyUnlockStatus, 'accent' | 'success' | 'danger' | 'neutral'> = {
  pending: 'accent',
  approved: 'success',
  rejected: 'danger',
  revoked: 'neutral',
  expired: 'neutral',
}

/** Vier-Augen-Freigabe: Antrag stellen (Admin), entscheiden (Datenschutzbeauftragter).
 *
 * Beide Rollen sehen dieselbe Liste — die Nachvollziehbarkeit des Verfahrens ist
 * Teil des Verfahrens. Handeln darf jede Rolle nur an ihrer Stelle. */
export default function PrivacyUnlockPanel() {
  const { t } = useI18n()
  const me = useMe()
  const isAdmin = me?.role === 'admin'
  const isOfficer = me?.role === 'privacy_officer'

  const [rows, setRows] = useState<PrivacyUnlockRequest[]>([])
  const [officers, setOfficers] = useState<PrivacyOfficer[] | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [reason, setReason] = useState('')
  const [scope, setScope] = useState('')
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    api.get<PrivacyUnlockRequest[]>('/privacy/unlock-requests').then((r) => setRows(r.data))
  }

  useEffect(() => {
    load()
    // Ohne Freigabeberechtigten bleibt jeder Antrag fuer immer offen - das muss
    // sichtbar sein, bevor jemand einen stellt.
    api
      .get<PrivacyOfficer[]>('/privacy/officers')
      .then((r) => setOfficers(r.data))
      .catch(() => setOfficers([]))
    if (isAdmin) api.get<Campaign[]>('/campaigns').then((r) => setCampaigns(r.data)).catch(() => setCampaigns([]))
  }, [isAdmin])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/privacy/unlock-requests', {
        reason,
        duration_hours: hours,
        campaign_id: scope || null,
      })
      setReason('')
      setScope('')
      load()
    } catch {
      setError(t('priv.unlock.err'))
    } finally {
      setBusy(false)
    }
  }

  async function act(id: string, action: 'approve' | 'reject' | 'revoke') {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/privacy/unlock-requests/${id}/${action}`)
      load()
    } catch {
      setError(t('priv.unlock.err'))
    } finally {
      setBusy(false)
    }
  }

  const campaignName = (id: string | null) =>
    id === null ? t('priv.unlock.scopeAll') : campaigns.find((c) => c.id === id)?.name ?? t('priv.unlock.scopeOne')

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold">{t('priv.unlock.heading')}</h2>
        <p className="mt-0.5 text-sm text-text-secondary">{t('priv.unlock.desc')}</p>
      </div>

      {error && <p className="text-sm text-status-danger">{error}</p>}

      {officers !== null &&
        (officers.length === 0 ? (
          <div className="flex gap-3 rounded-lg border border-status-warning/40 bg-status-warning/8 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-status-warning" />
            <div className="text-sm">
              <p className="font-medium text-text-primary">{t('priv.unlock.noOfficer')}</p>
              <p className="mt-0.5 text-text-secondary">{t('priv.unlock.noOfficerHint')}</p>
              {isAdmin && (
                <Link to="/users" className="mt-1.5 inline-block text-accent hover:underline">
                  {t('priv.unlock.toUsers')}
                </Link>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {t('priv.unlock.officers')}{' '}
            {officers.map((o, i) => (
              <span key={o.email}>
                {i > 0 && ', '}
                {o.full_name} <span className="font-mono text-xs">&lt;{o.email}&gt;</span>
              </span>
            ))}
          </p>
        ))}

      {isAdmin && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('priv.unlock.reason')}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={10}
              rows={3}
              placeholder={t('priv.unlock.reasonHint')}
              className="rounded-md border border-border bg-bg px-3 py-2 text-text-primary"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('priv.unlock.scope')}</span>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="rounded-md border border-border bg-bg px-3 py-2 text-text-primary"
              >
                <option value="">{t('priv.unlock.scopeAll')}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('priv.unlock.hours')}</span>
              <input
                type="number"
                min={1}
                max={168}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-24 rounded-md border border-border bg-bg px-3 py-2 text-text-primary"
              />
            </label>
          </div>
          <div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {t('priv.unlock.request')}
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('priv.unlock.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('priv.unlock.requester')}</th>
                <th className="py-2 pr-4 font-medium">{t('priv.unlock.scope')}</th>
                <th className="py-2 pr-4 font-medium">{t('priv.unlock.reason')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.status')}</th>
                <th className="py-2 pr-4 font-medium">{t('priv.unlock.validUntil')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{row.requested_by_email}</td>
                  <td className="py-2 pr-4">{campaignName(row.campaign_id)}</td>
                  <td className="py-2 pr-4 text-text-secondary">{row.reason}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={statusTone[row.status]}>{t(`priv.unlock.status.${row.status}`)}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-text-secondary">
                    {row.expires_at ? new Date(row.expires_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 whitespace-nowrap text-right">
                    {isOfficer && row.status === 'pending' && (
                      <>
                        <button
                          onClick={() => act(row.id, 'approve')}
                          disabled={busy}
                          className="mr-3 text-accent hover:underline disabled:opacity-60"
                        >
                          {t('priv.unlock.approve')}
                        </button>
                        <button
                          onClick={() => act(row.id, 'reject')}
                          disabled={busy}
                          className="text-status-danger hover:underline disabled:opacity-60"
                        >
                          {t('priv.unlock.reject')}
                        </button>
                      </>
                    )}
                    {row.active && (isOfficer || row.requested_by_email === me?.email) && (
                      <button
                        onClick={() => act(row.id, 'revoke')}
                        disabled={busy}
                        className="text-text-secondary hover:underline disabled:opacity-60"
                      >
                        {t('priv.unlock.revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
