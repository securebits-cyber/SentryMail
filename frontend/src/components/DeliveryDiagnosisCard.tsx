/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, CheckCircle2, Info, Stethoscope, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import Card from './Card'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { DeliveryDiagnosis, DiagFinding, DiagSeverity } from '../types'

const icons: Record<DiagSeverity, typeof Info> = {
  ok: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
}

const tone: Record<DiagSeverity, string> = {
  ok: 'text-status-success',
  info: 'text-text-secondary',
  warn: 'text-status-warning',
  error: 'text-status-danger',
}

/** Diagnose „Warum kam die Mail nicht an" (Welle 9.1).
 *
 * Der Endpunkt ist admin-only. Fuer alle anderen verschwindet die Karte
 * kommentarlos, statt eine Fehlermeldung zu zeigen, mit der niemand etwas
 * anfangen kann.
 */
export default function DeliveryDiagnosisCard({ campaignId }: { campaignId: string }) {
  const { t } = useI18n()
  const [data, setData] = useState<DeliveryDiagnosis | null>(null)

  useEffect(() => {
    api
      .get<DeliveryDiagnosis>(`/delivery/diagnosis/${campaignId}`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
  }, [campaignId])

  if (!data) return null

  const findings: DiagFinding[] = [...data.delivery, ...data.dns]
  const codes = Object.entries(data.stats.codes)

  return (
    <Card
      className="mt-6"
      title={t('deliv.diag.title')}
      subtitle={t('deliv.diag.subtitle', { domain: data.sender_domain || '—' })}
    >
      <ul className="flex flex-col gap-2">
        {findings.map((f) => {
          const Icon = icons[f.severity]
          return (
            <li key={f.code} className="flex items-start gap-2 text-sm">
              <Icon size={15} className={`mt-0.5 shrink-0 ${tone[f.severity]}`} />
              <span>{t(`deliv.diag.${f.code}`, f.params)}</span>
            </li>
          )
        })}
      </ul>

      {codes.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-sm text-text-secondary">{t('deliv.diag.codes')}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
            {codes.map(([code, count]) => (
              <li key={code}>
                {code} <span className="text-text-secondary">× {count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
        <Stethoscope size={15} className="mt-0.5 shrink-0" />
        {t('deliv.diag.note')}
      </p>
    </Card>
  )
}
