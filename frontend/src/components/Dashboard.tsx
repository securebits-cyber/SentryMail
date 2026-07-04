import { Link } from 'react-router-dom'
import type { Campaign } from '../types'

interface DashboardProps {
  campaigns: Campaign[]
}

const statusLabels: Record<Campaign['status'], string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  running: 'Laeuft',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
}

const statusColor: Record<Campaign['status'], string> = {
  draft: 'text-text-secondary',
  scheduled: 'text-status-warning',
  running: 'text-status-success',
  completed: 'text-text-secondary',
  cancelled: 'text-status-danger',
}

export default function Dashboard({ campaigns }: DashboardProps) {
  if (campaigns.length === 0) {
    return (
      <p className="text-text-secondary">
        Noch keine Kampagne gestartet &rarr; Erste Kampagne anlegen.
      </p>
    )
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          to={`/results/${campaign.id}`}
          className="rounded-md border border-border bg-surface p-4 text-text-primary no-underline hover:border-accent"
        >
          <strong className="font-semibold">{campaign.name}</strong>
          <div className={`mt-1 font-mono text-sm ${statusColor[campaign.status]}`}>
            {statusLabels[campaign.status]}
          </div>
        </Link>
      ))}
    </div>
  )
}
