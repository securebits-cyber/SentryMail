/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, CheckCircle2, Info, OctagonX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import { useMe } from '../hooks/useMe'
import type {
  Campaign,
  CampaignApproval,
  GroupSummary,
  PreflightResult,
  PreflightSeverity,
} from '../types'

const icons: Record<PreflightSeverity, typeof Info> = {
  ok: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  block: OctagonX,
}

const tone: Record<PreflightSeverity, string> = {
  ok: 'text-status-success',
  info: 'text-text-secondary',
  warn: 'text-status-warning',
  block: 'text-status-danger',
}

/** Pflichtdialog vor dem Kampagnenstart (Welle 9.2).
 *
 * Zeigt, wen der Versand trifft und wann — und weist auf Konflikte hin. Nur ein
 * blockierender Befund hält wirklich auf; Warnungen sind Warnungen, die
 * Entscheidung bleibt beim Betreiber.
 *
 * Ausschlüsse laufen ausschließlich über Gruppen. Es gibt bewusst kein Feld für
 * den Grund eines Ausschlusses.
 */
export default function PreflightDialog({
  campaign,
  onCancel,
  onConfirmed,
}: {
  campaign: Campaign
  onCancel: () => void
  onConfirmed: () => void
}) {
  const { t } = useI18n()
  const me = useMe()
  const [result, setResult] = useState<PreflightResult | null>(null)
  const [approval, setApproval] = useState<CampaignApproval | null>(null)
  const [reason, setReason] = useState('')
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [excluded, setExcluded] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void reload()
    api.get<GroupSummary[]>('/groups').then((r) => setGroups(r.data)).catch(() => undefined)
  }, [campaign.id])

  async function reload() {
    const res = await api.get<PreflightResult>(`/campaigns/${campaign.id}/preflight`)
    setResult(res.data)
    setExcluded(res.data.excluded_group_ids)
    if (res.data.requires_second_approval) {
      const a = await api.get<CampaignApproval | null>(`/campaigns/${campaign.id}/approval`)
      setApproval(a.data)
    }
  }

  async function requestApproval() {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/campaigns/${campaign.id}/approval`, { reason })
      setReason('')
      await reload()
    } catch {
      setError(t('pfd.err.approvalRequest'))
    } finally {
      setBusy(false)
    }
  }

  async function decide(approve: boolean) {
    if (!approval) return
    setBusy(true)
    setError(null)
    try {
      await api.patch(`/campaigns/${campaign.id}/approval/${approval.id}`, { approve })
      await reload()
    } catch {
      setError(t('pfd.err.approvalDecide'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleExclusion(groupId: string) {
    const next = excluded.includes(groupId)
      ? excluded.filter((g) => g !== groupId)
      : [...excluded, groupId]
    setExcluded(next)
    setError(null)
    try {
      await api.put(`/campaigns/${campaign.id}/exclusions`, { group_ids: next })
      await reload()
    } catch {
      setError(t('pfd.err.exclusions'))
    }
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/campaigns/${campaign.id}/preflight/ack`)
      onConfirmed()
    } catch {
      setError(t('pfd.err.ack'))
      setBusy(false)
    }
  }

  if (!result) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('pfd.title')}
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface p-5"
      >
        <h2 className="text-lg font-medium">{t('pfd.title')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('pfd.subtitle', { name: campaign.name })}</p>

        {/* Umfang */}
        <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-text-secondary">{t('pfd.recipients')}</dt>
          <dd className="font-mono">
            {result.recipients_effective}
            {result.recipients_excluded > 0 && (
              <span className="ml-2 font-sans text-text-secondary">
                {t('pfd.excludedNote', { count: result.recipients_excluded })}
              </span>
            )}
          </dd>
          <dt className="text-text-secondary">{t('pfd.window')}</dt>
          <dd className="font-mono">
            {result.send_window ? new Date(result.send_window).toLocaleString() : t('pfd.immediately')}
          </dd>
          <dt className="text-text-secondary">{t('pfd.riskClass')}</dt>
          <dd>{t(`tpl.risk.${result.risk_class}`)}</dd>
        </dl>

        {/* Betroffene Gruppen */}
        {result.groups.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium">{t('pfd.groups')}</p>
            <ul className="mt-1 text-sm text-text-secondary">
              {result.groups.map((g) => (
                <li key={g.id}>
                  {g.name} <span className="font-mono">({g.recipients})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Befunde */}
        {result.findings.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {result.findings.map((f, i) => {
              const Icon = icons[f.severity]
              return (
                <li key={`${f.code}-${i}`} className="flex items-start gap-2 text-sm">
                  <Icon size={15} className={`mt-0.5 shrink-0 ${tone[f.severity]}`} />
                  <span>{t(`pfd.finding.${f.code}`, f.params)}</span>
                </li>
              )
            })}
          </ul>
        )}

        {/* Ausschlüsse */}
        {groups.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-sm font-medium">{t('pfd.exclusions')}</p>
            <p className="mt-1 text-sm text-text-secondary">{t('pfd.exclusions.desc')}</p>
            <div className="mt-2 flex flex-col gap-1">
              {groups.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={excluded.includes(g.id)}
                    onChange={() => toggleExclusion(g.id)}
                    className="accent-accent"
                  />
                  {g.name} <span className="font-mono text-text-secondary">({g.member_count})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Zweitfreigabe: nur bei hoher Risikoklasse. Wer beantragt, entscheidet nicht. */}
        {result.requires_second_approval && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-sm font-medium">{t('pfd.approval')}</p>

            {!approval && (
              <>
                <p className="mt-1 text-sm text-text-secondary">
                  {t('pfd.approval.needed', { role: t(`pf.approval.${result.second_approval_role === 'admin' ? 'admin' : 'officer'}`) })}
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder={t('pfd.approval.reasonPlaceholder')}
                  className="mt-2 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                />
                <button
                  onClick={requestApproval}
                  disabled={busy || reason.trim().length < 10}
                  className="mt-2 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-60"
                >
                  {t('pfd.approval.request')}
                </button>
              </>
            )}

            {approval && (
              <div className="mt-1 text-sm">
                <p className="text-text-secondary">
                  {t(`pfd.approval.status.${approval.status}`, {
                    requester: approval.requested_by_email,
                    decider: approval.decided_by_email ?? '',
                  })}
                </p>
                <p className="mt-1 text-text-secondary">„{approval.reason}"</p>

                {/* Entscheiden darf nur die konfigurierte Rolle - und nie der
                    Antragsteller. Das Backend prueft beides erneut. */}
                {approval.status === 'pending' &&
                  me?.role === result.second_approval_role &&
                  me?.email !== approval.requested_by_email && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => decide(true)}
                        disabled={busy}
                        className="rounded-md border border-status-success px-3 py-1.5 text-sm text-status-success disabled:opacity-60"
                      >
                        {t('pfd.approval.approve')}
                      </button>
                      <button
                        onClick={() => decide(false)}
                        disabled={busy}
                        className="rounded-md border border-status-danger px-3 py-1.5 text-sm text-status-danger disabled:opacity-60"
                      >
                        {t('pfd.approval.reject')}
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm">
            {t('common.cancel')}
          </button>
          <button
            onClick={confirm}
            disabled={busy || result.blocked}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            title={result.blocked ? t('pfd.blocked') : undefined}
          >
            {t('pfd.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
