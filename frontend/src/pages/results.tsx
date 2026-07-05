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

  useEffect(() => {
    if (!campaignId) return
    api.get<CampaignResult>(`/results/${campaignId}`).then((res) => setResult(res.data))
  }, [campaignId])

  if (!result) return <p className="text-text-secondary">{t('res.loading')}</p>

  return (
    <PageScaffold title={t('res.title')} guidanceKey="results">
      <ResultsTable result={result} />
      <a
        href={`${import.meta.env.VITE_API_URL}/results/${campaignId}/export`}
        className="mt-4 inline-block text-accent underline"
      >
        {t('res.exportCsv')}
      </a>
    </PageScaffold>
  )
}
