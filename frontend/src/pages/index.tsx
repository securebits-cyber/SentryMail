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

  if (loading) return <p>Lade Kampagnen...</p>

  return (
    <>
      <h1>Dashboard</h1>
      <Dashboard campaigns={campaigns} />
    </>
  )
}
