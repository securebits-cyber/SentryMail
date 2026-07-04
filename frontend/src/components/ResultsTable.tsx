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
    <table className="min-w-[320px] border-collapse">
      <tbody>
        {rows.map(({ label, key }) => (
          <tr key={key} className="border-b border-border">
            <td className="py-2 pr-4 text-text-secondary">{label}</td>
            <td className="py-2 font-mono text-base font-semibold text-text-primary">{result[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
