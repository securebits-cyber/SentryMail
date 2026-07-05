import { useEffect, useState } from 'react'
import GroupForm, { GroupFormValues } from '../components/GroupForm'
import PageScaffold from '../components/PageScaffold'
import { api } from '../services/api'
import type { Group, GroupSummary } from '../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; group: Group }

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function load() {
    setLoading(true)
    api
      .get<GroupSummary[]>('/groups')
      .then((res) => setGroups(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleSubmit(values: GroupFormValues) {
    setSubmitting(true)
    setMessage(null)
    try {
      if (mode.kind === 'edit') {
        await api.patch(`/groups/${mode.group.id}`, values)
      } else {
        await api.post('/groups', values)
      }
      setMode({ kind: 'list' })
      load()
    } catch {
      setMessage({ kind: 'error', text: 'Gruppe konnte nicht gespeichert werden.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function openEdit(summary: GroupSummary) {
    setMessage(null)
    try {
      const res = await api.get<Group>(`/groups/${summary.id}`)
      setMode({ kind: 'edit', group: res.data })
    } catch {
      setMessage({ kind: 'error', text: 'Gruppe konnte nicht geladen werden.' })
    }
  }

  async function handleDelete(summary: GroupSummary) {
    if (!window.confirm(`Gruppe „${summary.name}“ wirklich löschen?`)) return
    setMessage(null)
    try {
      await api.delete(`/groups/${summary.id}`)
      load()
    } catch {
      setMessage({ kind: 'error', text: 'Gruppe konnte nicht gelöscht werden.' })
    }
  }

  async function handleLdapImport(summary: GroupSummary) {
    if (!window.confirm(`Empfänger aus LDAP in „${summary.name}“ importieren?`)) return
    setMessage({ kind: 'info', text: 'LDAP-Import läuft...' })
    try {
      const res = await api.post<{ success: boolean; detail: string }>(`/groups/${summary.id}/import/ldap`)
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
      if (res.data.success) load()
    } catch {
      setMessage({ kind: 'error', text: 'LDAP-Import fehlgeschlagen (Admin-Rechte nötig?).' })
    }
  }

  if (mode.kind !== 'list') {
    return (
      <PageScaffold title={mode.kind === 'edit' ? 'Gruppe bearbeiten' : 'Neue Gruppe'}>
        {message && <p className="mb-3 text-sm text-status-danger">{message.text}</p>}
        <GroupForm
          initial={mode.kind === 'edit' ? mode.group : null}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode({ kind: 'list' })
            setMessage(null)
          }}
          submitting={submitting}
        />
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title="Gruppen"
      guidanceKey="groups"
      actions={
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Neue Gruppe
        </button>
      }
    >
      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-text-secondary">Lade Gruppen...</p>
      ) : groups.length === 0 ? (
        <p className="text-text-secondary">Noch keine Gruppe vorhanden &rarr; Erste Gruppe anlegen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Empfänger</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-b border-border">
                  <td className="py-2 pr-4">{group.name}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">{group.member_count}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleLdapImport(group)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      LDAP-Import
                    </button>
                    <button onClick={() => openEdit(group)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      Bearbeiten
                    </button>
                    <button onClick={() => handleDelete(group)} className="text-status-danger hover:underline">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageScaffold>
  )
}
