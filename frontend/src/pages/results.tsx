/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FileText, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageScaffold from '../components/PageScaffold'
import ResultsTable from '../components/ResultsTable'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { CampaignResult } from '../types'

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
  const pdfLicensed = Boolean(features?.features?.business) // PDF-Export ist Business
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) return
    api.get<CampaignResult>(`/results/${campaignId}`).then((res) => setResult(res.data))
  }, [campaignId])

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
    if (!pdfLicensed) {
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
          <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white no-underline">
            {t('badge.business')}
          </span>
          {!pdfLicensed && <Lock size={13} className="text-text-secondary" />}
        </button>
      </div>
    </PageScaffold>
  )
}
