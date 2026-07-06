/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FileText, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageScaffold from '../components/PageScaffold'
import ResultsTable from '../components/ResultsTable'
import TierBadge from '../components/TierBadge'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { CampaignResult } from '../types'

interface Capture {
  recipient_email: string
  created_at: string
  fields: Record<string, string>
}

async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export default function ResultsPage() {
  const { t } = useI18n()
  const { campaignId } = useParams<{ campaignId: string }>()
  const features = useFeatures()
  const businessLicensed = Boolean(features?.features?.business) // PDF-Export ist Business
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) return
    api.get<CampaignResult>(`/results/${campaignId}`).then((res) => setResult(res.data))
  }, [campaignId])

  useEffect(() => {
    // Erfasste Formulardaten (Passwortabfrage) — nur mit Business-Lizenz.
    if (!campaignId || !businessLicensed) return
    api
      .get<Capture[]>(`/campaigns/${campaignId}/captures`)
      .then((res) => setCaptures(res.data))
      .catch(() => setCaptures([]))
  }, [campaignId, businessLicensed])

  // Über axios (Auth-Header via Interceptor) als Blob laden — ein reiner
  // <a href> würde das Bearer-Token nicht mitsenden (401).
  async function exportCsv() {
    if (!campaignId) return
    setExporting(true)
    try {
      await downloadBlob(`/results/${campaignId}/export`, `campaign_${campaignId}_results.csv`)
    } finally {
      setExporting(false)
    }
  }

  async function exportPdf() {
    if (!campaignId) return
    if (!businessLicensed) {
      setError(t('locked.body'))
      return
    }
    setExporting(true)
    try {
      await downloadBlob(`/results/${campaignId}/pdf`, `campaign_${campaignId}_results.pdf`)
    } finally {
      setExporting(false)
    }
  }

  if (!result) return <p className="text-text-secondary">{t('res.loading')}</p>

  return (
    <PageScaffold title={t('res.title')} guidanceKey="results">
      <ResultsTable result={result} />

      {captures.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">{t('res.captures.heading')}</h2>
          <p className="mb-3 text-xs text-text-secondary">{t('res.captures.note')}</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                  <th className="py-2 pr-4 font-medium">{t('res.captures.fields')}</th>
                  <th className="py-2 font-medium">{t('dash.col.time')}</th>
                </tr>
              </thead>
              <tbody>
                {captures.map((cap, i) => (
                  <tr key={i} className="border-b border-border align-top">
                    <td className="py-2 pr-4 font-mono">{cap.recipient_email}</td>
                    <td className="py-2 pr-4">
                      {Object.entries(cap.fields).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-text-secondary">{k}:</span> <span className="font-mono">{v}</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-2 font-mono text-text-secondary">{new Date(cap.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-status-danger">{error}</p>}
      <div className="mt-4 flex items-center gap-4">
        <button onClick={exportCsv} disabled={exporting} className="text-accent underline disabled:opacity-60">
          {t('res.exportCsv')}
        </button>
        <button
          onClick={exportPdf}
          disabled={exporting}
          className="inline-flex items-center gap-2 text-accent underline disabled:opacity-60"
        >
          <FileText size={14} />
          {t('res.exportPdf')}
          <TierBadge tier="business" className="no-underline" />
          {!businessLicensed && <Lock size={13} className="text-text-secondary" />}
        </button>
      </div>
    </PageScaffold>
  )
}
