import { FormEvent, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import PageScaffold from '../components/PageScaffold'
import { api } from '../services/api'
import type { User } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

function errText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export default function ProfilePage() {
  const [me, setMe] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api.get<User>('/me').then((res) => {
      setMe(res.data)
      setFullName(res.data.full_name)
    })
  }, [])

  async function saveName(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    try {
      const res = await api.patch<User>('/me', { full_name: fullName })
      setMe(res.data)
      setMessage({ kind: 'info', text: 'Profil gespeichert.' })
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, 'Speichern fehlgeschlagen.') })
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (newPw !== newPw2) {
      setMessage({ kind: 'error', text: 'Die neuen Passwörter stimmen nicht überein.' })
      return
    }
    try {
      await api.patch('/me', { current_password: currentPw, new_password: newPw })
      setCurrentPw('')
      setNewPw('')
      setNewPw2('')
      setMessage({ kind: 'info', text: 'Passwort geändert.' })
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, 'Passwort konnte nicht geändert werden.') })
    }
  }

  if (!me) return <p className="text-text-secondary">Lade Profil...</p>

  return (
    <PageScaffold title="Mein Profil" guidanceKey="profile">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <div className="flex max-w-2xl flex-col gap-8">
        <form onSubmit={saveName} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-secondary">Rolle:</span>
            <Badge tone={me.role === 'admin' ? 'accent' : 'neutral'}>
              {me.role === 'admin' ? 'Admin' : 'Benutzer'}
            </Badge>
          </div>
          <label className={labelClass}>
            E-Mail
            <input value={me.email} disabled className={`${fieldClass} font-mono opacity-70`} />
          </label>
          <label className={labelClass}>
            Name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass} />
          </label>
          <div>
            <button type="submit" className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
              Speichern
            </button>
          </div>
        </form>

        <form onSubmit={changePassword} className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">Passwort ändern</h2>
          <label className={labelClass}>
            Aktuelles Passwort
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={fieldClass} />
          </label>
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              Neues Passwort
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required className={fieldClass} />
            </label>
            <label className={`${labelClass} flex-1`}>
              Wiederholen
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required className={fieldClass} />
            </label>
          </div>
          <div>
            <button type="submit" className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
              Passwort ändern
            </button>
          </div>
        </form>
      </div>
    </PageScaffold>
  )
}
