import type { CampaignResult } from '../types'

interface ResultsTableProps {
  result: CampaignResult
}

const rows: Array<{ label: string; key: keyof CampaignResult }> = [
  { label: 'Empfaenger gesamt', key: 'total_recipients' },
  { label: 'Versendet', key: 'sent' },
  { label: 'Geoeffnet', key: 'opened' },
  { label: 'Angeklickt', key: 'clicked' },
  { label: 'Formular abgeschickt', key: 'submitted' },
]

export default function ResultsTable({ result }: ResultsTableProps) {
  return (
    <table style={{ borderCollapse: 'collapse', minWidth: 320 }}>
      <tbody>
        {rows.map(({ label, key }) => (
          <tr key={key} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--space-sm) var(--space-md) var(--space-sm) 0', color: 'var(--color-fg-muted)' }}>
              {label}
            </td>
            <td style={{ padding: 'var(--space-sm) 0', fontWeight: 600 }}>{result[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
