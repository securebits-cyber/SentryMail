/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import TierBadge from './TierBadge'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { AddonState } from '../hooks/useFeatures'
import type { QuarantineRun } from '../types'

/**
 * Massen-Quarantäne einer gemeldeten Mail (Enterprise).
 *
 * Der Ablauf ist zweistufig und lässt sich nicht abkürzen: erst Probelauf,
 * dann Ausführung des *gespeicherten* Laufs. Die Oberfläche bildet damit ab,
 * was der Server ohnehin erzwingt — ohne Vorschau-Datensatz gibt es nichts
 * auszuführen.
 */
export default function QuarantinePanel({ mailId, addon }: { mailId: string; addon: AddonState }) {
  const licensed = addon === 'ready'
  const { t } = useI18n()
  const [run, setRun] = useState<QuarantineRun | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function call(path: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<QuarantineRun>(path)
      setRun(res.data)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('qr.err'))
    } finally {
      setBusy(false)
    }
  }

  if (!licensed)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
        <TierBadge tier="enterprise" locked />
        {/* Lizenziert, aber Paket nicht installiert: Der Hinweis auf die Lizenz
            waere hier falsch - abhelfen muss der Betreiber, nicht der Kunde. */}
        {addon === 'missing' ? t('missing.title') : t('qr.locked')}
      </div>
    )

  const executed = run !== null && !run.dry_run

  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldAlert size={15} className="text-status-warning" />
        {t('qr.title')}
      </div>

      {error && <p className="mb-2 text-sm text-status-danger">{error}</p>}

      {run === null ? (
        <>
          <p className="mb-3 text-sm text-text-secondary">{t('qr.intro')}</p>
          <button
            onClick={() => call(`/quarantine/preview/${mailId}`)}
            disabled={busy}
            className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
          >
            {busy ? t('qr.running') : t('qr.preview')}
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm">
            {executed
              ? t('qr.resultExecuted', {
                  moved: String(run.messages_moved),
                  boxes: String(run.mailboxes_checked),
                })
              : t('qr.resultPreview', {
                  found: String(run.messages_found),
                  boxes: String(run.mailboxes_checked),
                })}
          </p>

          {run.details.length > 0 && (
            <ul className="mb-3 max-h-48 overflow-y-auto text-sm">
              {run.details.map((detail) => (
                <li key={detail.mailbox} className="flex flex-wrap gap-2 border-b border-border py-1 last:border-0">
                  <span className="font-mono text-xs">{detail.mailbox}</span>
                  {detail.error ? (
                    <span className="text-status-danger">{detail.error}</span>
                  ) : (
                    <span className="text-text-secondary">
                      {executed ? t('qr.movedN', { n: String(detail.moved) }) : t('qr.foundN', { n: String(detail.found) })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {executed ? (
            <p className="text-sm text-text-secondary">
              {t('qr.doneHint', { folder: t('qr.folder') })}
            </p>
          ) : run.messages_found === 0 ? (
            <p className="text-sm text-text-secondary">{t('qr.nothingFound')}</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-text-secondary">{t('qr.confirmHint')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (window.confirm(t('qr.confirm', { n: String(run.messages_found) }))) {
                      call(`/quarantine/execute/${run.id}`)
                    }
                  }}
                  disabled={busy}
                  className="rounded-full bg-status-warning px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy ? t('qr.running') : t('qr.execute')}
                </button>
                <button
                  onClick={() => setRun(null)}
                  disabled={busy}
                  className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
