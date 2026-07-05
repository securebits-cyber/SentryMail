import Badge from './Badge'
import type { CampaignResult } from '../types'

interface ResultsTableProps {
  result: CampaignResult
}

const summaryRows: Array<{ label: string; key: 'total_recipients' | 'sent' | 'opened' | 'clicked' | 'submitted' }> = [
  { label: 'Empfänger gesamt', key: 'total_recipients' },
  { label: 'Versendet', key: 'sent' },
  { label: 'Geöffnet', key: 'opened' },
  { label: 'Angeklickt', key: 'clicked' },
  { label: 'Formular abgeschickt', key: 'submitted' },
]

function yesNo(active: boolean, label: string, tone: 'success' | 'warning' | 'danger') {
  return active ? <Badge tone={tone}>{label}</Badge> : <span className="text-text-secondary">—</span>
}

export default function ResultsTable({ result }: ResultsTableProps) {
  return (
    <div className="flex flex-col gap-8">
      <table className="min-w-[320px] border-collapse">
        <tbody>
          {summaryRows.map(({ label, key }) => (
            <tr key={key} className="border-b border-border">
              <td className="py-2 pr-4 text-text-secondary">{label}</td>
              <td className="py-2 font-mono text-base font-semibold text-text-primary">{result[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Pro Empfänger</h2>
        {result.recipients.length === 0 ? (
          <p className="text-text-secondary">Noch keine Empfänger.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-sm text-text-secondary">
                  <th className="py-2 pr-4 font-medium">E-Mail</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Versendet</th>
                  <th className="py-2 pr-4 font-medium">Geöffnet</th>
                  <th className="py-2 pr-4 font-medium">Geklickt</th>
                  <th className="py-2 font-medium">Daten abgeschickt</th>
                </tr>
              </thead>
              <tbody>
                {result.recipients.map((r) => (
                  <tr key={r.email} className="border-b border-border">
                    <td className="py-2 pr-4 font-mono text-sm">{r.email}</td>
                    <td className="py-2 pr-4">{[r.first_name, r.last_name].filter(Boolean).join(' ')}</td>
                    <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                      {r.sent_at ? new Date(r.sent_at).toLocaleString('de-DE') : '—'}
                    </td>
                    <td className="py-2 pr-4">{yesNo(r.opened, 'Geöffnet', 'success')}</td>
                    <td className="py-2 pr-4">{yesNo(r.clicked, 'Geklickt', 'warning')}</td>
                    <td className="py-2">{yesNo(r.submitted, 'Abgeschickt', 'danger')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
