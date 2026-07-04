import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ResultsTable from '../components/ResultsTable'
import { api } from '../services/api'
import type { CampaignResult } from '../types'

export default function ResultsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [result, setResult] = useState<CampaignResult | null>(null)

  useEffect(() => {
    if (!campaignId) return
    api.get<CampaignResult>(`/results/${campaignId}`).then((res) => setResult(res.data))
  }, [campaignId])

  if (!result) return <p className="text-text-secondary">Lade Ergebnisse...</p>

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Ergebnisse</h1>
      <ResultsTable result={result} />
      <a
        href={`${import.meta.env.VITE_API_URL}/results/${campaignId}/export`}
        className="mt-4 inline-block text-accent underline"
      >
        Als CSV exportieren
      </a>
    </>
  )
}
