import { ShieldCheck } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import PageScaffold from '../components/PageScaffold'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import TwoFASetup from '../components/TwoFASetup'
import { api } from '../services/api'
import type { TwoFAStatus, User } from '../types'

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

  // 2FA
  const [twofa, setTwofa] = useState<TwoFAStatus | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [twofaPw, setTwofaPw] = useState('')
  const [newBackup, setNewBackup] = useState<string[] | null>(null)
  const [twofaMsg, setTwofaMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function loadTwofa() {
    api.get<TwoFAStatus>('/me/2fa').then((res) => setTwofa(res.data))
  }

  useEffect(() => {
    api.get<User>('/me').then((res) => {
      setMe(res.data)
      setFullName(res.data.full_name)
    })
    loadTwofa()
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

  async function disableTwofa() {
    setTwofaMsg(null)
    try {
      await api.post('/me/2fa/disable', { password: twofaPw })
      setTwofaPw('')
      setNewBackup(null)
      loadTwofa()
      setTwofaMsg({ kind: 'info', text: '2FA deaktiviert.' })
    } catch (e) {
      setTwofaMsg({ kind: 'error', text: errText(e, '2FA konnte nicht deaktiviert werden.') })
    }
  }

  async function regenerateBackup() {
    setTwofaMsg(null)
    try {
      const res = await api.post<{ backup_codes: string[] }>('/me/2fa/backup-codes/regenerate', { password: twofaPw })
      setTwofaPw('')
      setNewBackup(res.data.backup_codes)
      loadTwofa()
    } catch (e) {
      setTwofaMsg({ kind: 'error', text: errText(e, 'Backup-Codes konnten nicht erneuert werden.') })
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
          <PasswordStrengthMeter password={newPw} />
          <div>
            <button type="submit" className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
              Passwort ändern
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck size={18} /> Zwei-Faktor-Authentifizierung
          </h2>

          {twofaMsg && (
            <p className={`text-sm ${twofaMsg.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
              {twofaMsg.text}
            </p>
          )}

          {twofa && !twofa.enabled && !showSetup && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-secondary">
                Schütze dein Konto mit einem zweiten Faktor.
                {twofa.required && (
                  <span className="text-status-warning"> Für dein Konto ist 2FA verpflichtend.</span>
                )}
              </p>
              <div>
                <button onClick={() => setShowSetup(true)} className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
                  2FA aktivieren
                </button>
              </div>
            </div>
          )}

          {showSetup && (
            <TwoFASetup
              onCancel={() => setShowSetup(false)}
              onDone={() => {
                setShowSetup(false)
                loadTwofa()
                setTwofaMsg({ kind: 'info', text: '2FA ist aktiv.' })
              }}
            />
          )}

          {twofa && twofa.enabled && !showSetup && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="success">Aktiv</Badge>
                <span className="text-text-secondary">
                  Methode: {twofa.method === 'totp' ? 'Authenticator-App' : 'E-Mail-Code'} · Backup-Codes übrig:{' '}
                  <span className="font-mono text-text-primary">{twofa.backup_codes_remaining}</span>
                </span>
              </div>

              {newBackup && (
                <div>
                  <p className="mb-2 text-sm text-text-secondary">Neue Backup-Codes (nur jetzt sichtbar):</p>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-bg p-3 font-mono text-sm sm:grid-cols-4">
                    {newBackup.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
                <label className={labelClass}>
                  Zum Bestätigen: Passwort
                  <input type="password" value={twofaPw} onChange={(e) => setTwofaPw(e.target.value)} className={`${fieldClass} max-w-xs`} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={regenerateBackup}
                    disabled={!twofaPw}
                    className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
                  >
                    Backup-Codes neu erzeugen
                  </button>
                  <button
                    onClick={disableTwofa}
                    disabled={!twofaPw || twofa.required}
                    title={twofa.required ? '2FA ist für dein Konto verpflichtend' : undefined}
                    className="rounded-md border border-status-danger/40 px-4 py-2 text-sm text-status-danger hover:bg-status-danger/10 disabled:opacity-60"
                  >
                    2FA deaktivieren
                  </button>
                </div>
                {twofa.required && (
                  <p className="text-xs text-text-secondary">2FA ist für dein Konto verpflichtend und kann nicht deaktiviert werden.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </PageScaffold>
  )
}
