import { FormEvent, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import PageScaffold from '../components/PageScaffold'
import { api } from '../services/api'
import type { User } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

/** Fehlermeldung des Backends (detail) herausziehen, sonst Fallback. */
function errText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  // Formular fuer neuen Benutzer
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .get<User[]>('/users')
      .then((res) => setUsers(res.data))
      .catch(() => setMessage({ kind: 'error', text: 'Benutzer konnten nicht geladen werden (Admin-Rechte nötig?).' }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      await api.post('/users', { email, full_name: fullName, password, role })
      setEmail('')
      setFullName('')
      setPassword('')
      setRole('user')
      setCreating(false)
      load()
      setMessage({ kind: 'info', text: 'Benutzer angelegt.' })
    } catch {
      setMessage({ kind: 'error', text: 'Benutzer konnte nicht angelegt werden (E-Mail schon vergeben?).' })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user: User) {
    setMessage(null)
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
      load()
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, 'Status konnte nicht geändert werden.') })
    }
  }

  async function handleDelete(user: User) {
    if (!window.confirm(`Benutzer „${user.email}“ wirklich löschen?`)) return
    setMessage(null)
    try {
      await api.delete(`/users/${user.id}`)
      load()
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, 'Benutzer konnte nicht gelöscht werden.') })
    }
  }

  async function resetTwofa(user: User) {
    if (!window.confirm(`2FA von „${user.email}“ zurücksetzen?`)) return
    setMessage(null)
    try {
      await api.post(`/users/${user.id}/2fa/reset`)
      load()
      setMessage({ kind: 'info', text: '2FA zurückgesetzt.' })
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, '2FA konnte nicht zurückgesetzt werden.') })
    }
  }

  return (
    <PageScaffold
      title="Benutzer"
      guidanceKey="users"
      actions={
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {creating ? 'Schließen' : 'Neuer Benutzer'}
        </button>
      }
    >
      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="elevated mb-6 flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              E-Mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
            </label>
            <label className={`${labelClass} flex-1`}>
              Name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass} />
            </label>
          </div>
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              Passwort
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
            </label>
            <label className={`${labelClass} w-40`}>
              Rolle
              <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')} className={fieldClass}>
                <option value="user">Benutzer</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? 'Anlegen...' : 'Anlegen'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-text-secondary">Lade Benutzer...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">E-Mail</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Rolle</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono text-sm">{user.email}</td>
                  <td className="py-2 pr-4">{user.full_name}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
                      {user.role === 'admin' ? 'Admin' : 'Benutzer'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                      {user.twofa_enabled && <Badge tone="accent">2FA</Badge>}
                    </div>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => toggleActive(user)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      {user.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    {user.twofa_enabled && (
                      <button onClick={() => resetTwofa(user)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                        2FA zurücksetzen
                      </button>
                    )}
                    <button onClick={() => handleDelete(user)} className="text-status-danger hover:underline">
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
