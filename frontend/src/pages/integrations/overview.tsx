import { Blocks, LayoutGrid } from 'lucide-react'
import PageScaffold from '../../components/PageScaffold'

export default function IntegrationsOverviewPage() {
  return (
    <PageScaffold
      title="Integrationen"
      subtitle="Verbindungen zu externen Systemen — hier werden künftige Integrationen konfiguriert."
      breadcrumb={[
        { label: 'Integrationen', icon: Blocks },
        { label: 'Übersicht', icon: LayoutGrid },
      ]}
    >
      <div className="max-w-2xl rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">Noch keine Integrationen aktiv.</p>
        <p className="mt-2">
          Dieser Bereich ist für spätere Erweiterungen vorbereitet — etwa die Anbindung an
          Ticketing-, SIEM- oder Chat-Systeme. Neue Integrationen erscheinen dann als eigene
          Punkte in der linken Spalte, analog zum Einstellungen-Menü.
        </p>
      </div>
    </PageScaffold>
  )
}
