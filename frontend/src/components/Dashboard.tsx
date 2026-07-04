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

export default function Dashboard({ campaigns }: DashboardProps) {
  if (campaigns.length === 0) {
    return <p style={{ color: 'var(--color-fg-muted)' }}>Noch keine Kampagnen vorhanden.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-md)', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          to={`/results/${campaign.id}`}
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            color: 'inherit',
            textDecoration: 'none',
            background: 'var(--color-bg-subtle)',
          }}
        >
          <strong>{campaign.name}</strong>
          <div style={{ color: 'var(--color-fg-muted)', marginTop: 'var(--space-xs)' }}>
            {statusLabels[campaign.status]}
          </div>
        </Link>
      ))}
    </div>
  )
}
