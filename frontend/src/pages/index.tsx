import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import { api } from '../services/api'

interface Summary {
  campaigns: number
  recipients: number
  sent: number
  opened: number
  clicked: number
  submitted: number
}

interface Failed {
  email: string
  first_name: string | null
  last_name: string | null
  campaign_id: string
  campaign_name: string
  status: 'clicked' | 'submitted'
  occurred_at: string
}

type Tone = 'neutral' | 'accent' | 'warning' | 'danger'

const tiles: { key: keyof Summary; label: string; tone: Tone }[] = [
  { key: 'campaigns', label: 'Kampagnen', tone: 'neutral' },
  { key: 'recipients', label: 'Empfänger', tone: 'neutral' },
  { key: 'sent', label: 'Versendet', tone: 'accent' },
  { key: 'opened', label: 'Geöffnet', tone: 'neutral' },
  { key: 'clicked', label: 'Geklickt', tone: 'warning' },
  { key: 'submitted', label: 'Daten abgeschickt', tone: 'danger' },
]

const toneNumber: Record<Tone, string> = {
  neutral: 'text-text-primary',
  accent: 'text-accent',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
}

// Dezent getönter Kachel-Hintergrund je nach Bedeutung (etwas mehr Farbe).
const toneTile: Record<Tone, string> = {
  neutral: 'border-border bg-surface',
  accent: 'border-accent/25 bg-accent/8',
  warning: 'border-status-warning/30 bg-status-warning/10',
  danger: 'border-status-danger/30 bg-status-danger/10',
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [failed, setFailed] = useState<Failed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<Summary>('/dashboard/summary').then((r) => setSummary(r.data)),
      api.get<Failed[]>('/dashboard/failed').then((r) => setFailed(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-text-secondary">Lade Übersicht...</p>

  return (
    <>
      <PageHeader title="Control-Center" subtitle="Überblick über Kampagnen und Awareness-Ergebnisse" />

      <div className="mb-8 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {tiles.map(({ key, label, tone }) => (
          <div key={key} className={`elevated rounded-lg border p-4 ${toneTile[tone]}`}>
            <div className="text-sm text-text-secondary">{label}</div>
            <div className={`mt-1 font-mono text-3xl font-semibold ${toneNumber[tone]}`}>{summary?.[key] ?? 0}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Nicht bestanden</h2>
      {failed.length === 0 ? (
        <p className="text-text-secondary">
          Noch niemand hat geklickt oder Daten abgeschickt — oder es wurde noch keine Kampagne ausgewertet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">E-Mail</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Kampagne</th>
                <th className="py-2 pr-4 font-medium">Ereignis</th>
                <th className="py-2 font-medium">Zeitpunkt</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((f) => (
                <tr key={`${f.email}-${f.campaign_id}`} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono text-sm">{f.email}</td>
                  <td className="py-2 pr-4">{[f.first_name, f.last_name].filter(Boolean).join(' ')}</td>
                  <td className="py-2 pr-4">
                    <Link to={`/results/${f.campaign_id}`} className="text-text-secondary hover:text-accent hover:underline">
                      {f.campaign_name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone={f.status === 'submitted' ? 'danger' : 'warning'}>
                      {f.status === 'submitted' ? 'Daten abgeschickt' : 'Link geklickt'}
                    </Badge>
                  </td>
                  <td className="py-2 font-mono text-sm text-text-secondary">
                    {new Date(f.occurred_at).toLocaleString('de-DE')}
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
