import { useEffect, useState } from 'react'
import Dashboard from '../components/Dashboard'
import { api } from '../services/api'
import type { Campaign } from '../types'

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Campaign[]>('/campaigns')
      .then((res) => setCampaigns(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-text-secondary">Lade Kampagnen...</p>

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <Dashboard campaigns={campaigns} />
    </>
  )
}
