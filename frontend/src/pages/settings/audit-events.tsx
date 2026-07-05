import { Activity, ScrollText, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/Badge'
import PageScaffold from '../../components/PageScaffold'
import { api } from '../../services/api'
import type { AuditEvent, AuditEventList } from '../../types'

function initial(ev: AuditEvent): string {
  return (ev.actor_name || ev.actor_email || '?').trim().charAt(0).toUpperCase()
}

export default function AuditEventsPage() {
  const [data, setData] = useState<AuditEventList | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  function load() {
    api
      .get<AuditEventList>('/audit-events', { params: { limit: 100 } })
      .then((res) => setData(res.data))
      .catch(() => setError('Audit-Events konnten nicht geladen werden (Admin-Rechte nötig?).'))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data.events
    return data.events.filter((e) =>
      [e.actor_name, e.actor_email, e.action, e.description, e.ip ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <PageScaffold
      title="Audit Events"
      subtitle="Anmeldeaktivitäten und Änderungen am System — chronologisch, neueste zuerst."
      breadcrumb={[
        { label: 'Einstellungen', icon: Settings },
        { label: 'Aktivität', icon: Activity },
        { label: 'Audit Events', icon: ScrollText },
      ]}
    >
      {error && <p className="mb-4 text-sm text-status-danger">{error}</p>}

      {!data ? (
        <p className="text-text-secondary">Lade Audit-Events...</p>
      ) : (
        <div className="max-w-3xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="text-sm text-text-secondary">
              <span className="font-mono text-text-primary">{data.total}</span> Ereignisse
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche nach Nutzer, Aktion, IP..."
              className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-text-secondary">Keine passenden Ereignisse.</p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((ev) => (
                <li key={ev.id} className="flex gap-3 border-l border-border pl-4 pb-5 last:pb-0">
                  <div className="-ml-[33px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-medium text-text-secondary">
                    {initial(ev)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <div className="text-sm">
                        <span className="font-medium">{ev.actor_name || 'System'}</span>
                        {ev.actor_email && <span className="ml-2 text-text-secondary">{ev.actor_email}</span>}
                      </div>
                      <div className="font-mono text-xs text-text-secondary">
                        {new Date(ev.created_at).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg border border-border bg-surface p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={ev.category === 'auth' ? 'accent' : 'neutral'}>
                          {ev.category === 'auth' ? 'Anmeldung' : 'System'}
                        </Badge>
                        <span className="font-mono text-xs text-text-secondary">{ev.action}</span>
                      </div>
                      <p className="mt-2 text-text-primary">{ev.description}</p>
                      {ev.ip && <p className="mt-1 font-mono text-xs text-text-secondary">IP {ev.ip}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageScaffold>
  )
}
