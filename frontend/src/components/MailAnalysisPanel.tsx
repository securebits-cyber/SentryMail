/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, Paperclip } from 'lucide-react'
import { useEffect, useState } from 'react'
import RiskBadge from './RiskBadge'
import TierBadge from './TierBadge'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { MailAnalysis } from '../types'

/** Ampel für ein einzelnes Authentifizierungsergebnis. */
function AuthResult({ label, value }: { label: string; value: string }) {
  const { t } = useI18n()
  const tone =
    value === 'pass'
      ? 'text-status-success'
      : value === 'fail' || value === 'softfail'
        ? 'text-status-danger'
        : 'text-text-secondary'
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className={`font-mono text-sm font-semibold ${tone}`}>
        {/* "unknown" heisst: der Header fehlte. Das ist ausdruecklich nicht
            dasselbe wie "bestanden" und wird deshalb benannt. */}
        {value === 'unknown' ? t('ma.unknown') : value}
      </dd>
    </div>
  )
}

/** Auswertung einer gemeldeten Mail (Enterprise). */
export default function MailAnalysisPanel({ mailId, licensed }: { mailId: string; licensed: boolean }) {
  const { t } = useI18n()
  const [analysis, setAnalysis] = useState<MailAnalysis | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!licensed) return
    api
      .get<MailAnalysis>(`/reported-mails/${mailId}/analysis`)
      .then((res) => {
        setAnalysis(res.data)
        setState('ready')
      })
      .catch(() => setState('missing'))
  }, [mailId, licensed])

  if (!licensed)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
        <TierBadge tier="enterprise" locked />
        {t('ma.locked')}
      </div>
    )
  if (state === 'loading') return <p className="p-3 text-sm text-text-secondary">{t('ma.loading')}</p>
  if (state === 'missing' || analysis === null)
    return <p className="p-3 text-sm text-text-secondary">{t('ma.missing')}</p>

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge level={analysis.level} label={`${analysis.score}/100`} />
        <span className="text-sm text-text-secondary">{t('ma.scoreHint')}</span>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        <AuthResult label="SPF" value={analysis.spf_result} />
        <AuthResult label="DKIM" value={analysis.dkim_result} />
        <AuthResult label="DMARC" value={analysis.dmarc_result} />
        <div>
          <dt className="text-xs uppercase tracking-wide text-text-secondary">{t('ma.hops')}</dt>
          <dd className="font-mono text-sm">{analysis.hop_count}</dd>
        </div>
      </dl>

      <div>
        <h4 className="mb-1.5 text-sm font-semibold">{t('ma.findings')}</h4>
        {analysis.findings.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('ma.noFindings')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {analysis.findings.map((finding) => (
              <li key={finding.rule} className="flex gap-2 text-sm">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-status-warning" />
                <span>
                  {finding.detail}
                  <span className="ml-1.5 font-mono text-xs text-text-secondary">
                    +{finding.weight} · {finding.rule}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-1.5 text-sm font-semibold">{t('ma.urls')}</h4>
        {analysis.urls.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('ma.noUrls')}</p>
        ) : (
          <>
            {/* Bewusst als Text, nie als <a>: die Adressen sind entschaerft
                gespeichert, damit beim Sichten niemand versehentlich klickt. */}
            <ul className="flex flex-col gap-1 font-mono text-xs break-all">
              {analysis.urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-text-secondary">{t('ma.urlHint')}</p>
          </>
        )}
      </div>

      {analysis.intel_status && analysis.intel_status !== 'disabled' && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">{t('ma.intel')}</h4>
          {analysis.intel_status === 'unavailable' ? (
            // Ausgefallener Abgleich darf nicht wie ein geprueftes "unbekannt"
            // aussehen - deshalb ausdruecklich benannt.
            <p className="text-sm text-status-warning">{t('ma.intel.unavailable')}</p>
          ) : (analysis.intel_hits ?? []).length === 0 ? (
            <p className="text-sm text-text-secondary">{t('ma.intel.none')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {(analysis.intel_hits ?? []).map((hit) => (
                <li key={hit.indicator + hit.event_id} className="flex gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-status-danger" />
                  <span>
                    <span className="font-mono text-xs break-all">{hit.indicator}</span>
                    <span className="ml-1.5 text-text-secondary">
                      {hit.type} · Event {hit.event_id} {hit.event_info && `— ${hit.event_info}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {analysis.attachments.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">{t('ma.attachments')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="py-1.5 pr-4 font-medium">{t('ma.att.name')}</th>
                  <th className="py-1.5 pr-4 font-medium">{t('ma.att.type')}</th>
                  <th className="py-1.5 pr-4 font-medium">{t('ma.att.size')}</th>
                  <th className="py-1.5 pr-4 font-medium">{t('ma.att.scan')}</th>
                  <th className="py-1.5 font-medium">SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {analysis.attachments.map((attachment) => (
                  <tr key={attachment.sha256 + attachment.filename} className="border-b border-border">
                    <td className="py-1.5 pr-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Paperclip size={12} className="shrink-0 text-text-secondary" />
                        {attachment.filename}
                      </span>
                      {attachment.risky && (
                        <span className="ml-2 align-middle">
                          <RiskBadge level="high" size="sm" showDot={false} label={t('ma.att.risky')} />
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-text-secondary">{attachment.content_type}</td>
                    <td className="py-1.5 pr-4 font-mono tabular-nums text-text-secondary">
                      {Math.max(1, Math.round(attachment.size_bytes / 1024))} KB
                    </td>
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      {attachment.scan_result === 'infected' ? (
                        <RiskBadge
                          level="high"
                          size="sm"
                          showDot={false}
                          label={attachment.scan_signature || t('ma.scan.infected')}
                        />
                      ) : attachment.scan_result === 'clean' ? (
                        <span className="text-status-success">{t('ma.scan.clean')}</span>
                      ) : (
                        // Nicht geprueft ist nicht sauber - deshalb neutral statt gruen.
                        <span className="text-text-secondary">
                          {attachment.scan_result === 'disabled' ? t('ma.scan.disabled') : t('ma.scan.unavailable')}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 font-mono break-all text-text-secondary">{attachment.sha256}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
