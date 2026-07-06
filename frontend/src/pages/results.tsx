/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageScaffold from '../components/PageScaffold'
import ResultsTable from '../components/ResultsTable'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { CampaignResult } from '../types'

export default function ResultsPage() {
  const { t } = useI18n()
  const { campaignId } = useParams<{ campaignId: string }>()
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!campaignId) return
    api.get<CampaignResult>(`/results/${campaignId}`).then((res) => setResult(res.data))
  }, [campaignId])

  async function exportCsv() {
    if (!campaignId) return
    setExporting(true)
    try {
      // Über axios (Auth-Header via Interceptor) als Blob laden und herunterladen —
      // ein reiner <a href> würde das Bearer-Token nicht mitsenden (401).
      const res = await api.get(`/results/${campaignId}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `campaign_${campaignId}_results.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (!result) return <p className="text-text-secondary">{t('res.loading')}</p>

  return (
    <PageScaffold title={t('res.title')} guidanceKey="results">
      <ResultsTable result={result} />
      <button
        onClick={exportCsv}
        disabled={exporting}
        className="mt-4 inline-block text-accent underline disabled:opacity-60"
      >
        {t('res.exportCsv')}
      </button>
    </PageScaffold>
  )
}
