import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CampaignWizard, { CampaignWizardValues } from '../components/CampaignWizard'
import { api } from '../services/api'
import type { Campaign, GroupSummary, LandingPage, SendingProfile, Template } from '../types'

const statusLabels: Record<Campaign['status'], string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  running: 'Läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [profiles, setProfiles] = useState<SendingProfile[]>([])
  const [pages, setPages] = useState<LandingPage[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function loadCampaigns() {
    return api.get<Campaign[]>('/campaigns').then((res) => setCampaigns(res.data))
  }

  useEffect(() => {
    Promise.all([
      loadCampaigns(),
      api.get<Template[]>('/templates').then((res) => setTemplates(res.data)),
      api.get<SendingProfile[]>('/sending-profiles').then((res) => setProfiles(res.data)),
      api.get<LandingPage[]>('/landing-pages').then((res) => setPages(res.data)),
      api.get<GroupSummary[]>('/groups').then((res) => setGroups(res.data)),
    ]).finally(() => setLoading(false))
  }, [])

  async function handleCreate(values: CampaignWizardValues) {
    setSubmitting(true)
    setMessage(null)
    try {
      await api.post('/campaigns', values)
      setCreating(false)
      await loadCampaigns()
      setMessage({ kind: 'info', text: 'Kampagne wurde angelegt.' })
    } catch {
      setMessage({ kind: 'error', text: 'Kampagne konnte nicht angelegt werden.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSend(campaign: Campaign) {
    if (!window.confirm(`Kampagne „${campaign.name}“ jetzt versenden?`)) return
    setMessage({ kind: 'info', text: 'Versand läuft...' })
    try {
      const res = await api.post<{ success: number; failed: number }>(`/campaigns/${campaign.id}/send`)
      setMessage({ kind: 'info', text: `Versand abgeschlossen: ${res.data.success} ok, ${res.data.failed} fehlgeschlagen.` })
      await loadCampaigns()
    } catch {
      setMessage({ kind: 'error', text: 'Versand fehlgeschlagen.' })
    }
  }

  async function handleDelete(campaign: Campaign) {
    if (!window.confirm(`Kampagne „${campaign.name}“ wirklich löschen?`)) return
    setMessage(null)
    try {
      await api.delete(`/campaigns/${campaign.id}`)
      await loadCampaigns()
    } catch {
      setMessage({ kind: 'error', text: 'Kampagne konnte nicht gelöscht werden.' })
    }
  }

  if (creating) {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold">Neue Kampagne</h1>
        {templates.length === 0 && (
          <p className="mb-3 text-sm text-status-danger">Erst eine Vorlage anlegen.</p>
        )}
        <CampaignWizard
          templates={templates}
          profiles={profiles}
          pages={pages}
          groups={groups}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
          submitting={submitting}
        />
      </>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kampagnen</h1>
        <button
          onClick={() => setCreating(true)}
          disabled={templates.length === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Neue Kampagne
        </button>
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-text-secondary">Lade Kampagnen...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-text-secondary">Noch keine Kampagne gestartet &rarr; Erste Kampagne anlegen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-border">
                  <td className="py-2 pr-4">{campaign.name}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {statusLabels[campaign.status]}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleSend(campaign)} className="mr-3 text-accent hover:underline">
                      Senden
                    </button>
                    <Link to={`/results/${campaign.id}`} className="mr-3 text-accent hover:underline">
                      Ergebnisse
                    </Link>
                    <button onClick={() => handleDelete(campaign)} className="text-status-danger hover:underline">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
