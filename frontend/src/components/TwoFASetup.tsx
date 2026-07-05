import { KeyRound, Mail, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { api } from '../services/api'
import type { TotpSetup, TwoFAActivated } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const primaryBtn = 'rounded-md bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60'
const ghostBtn = 'rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg'

function detail(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof d === 'string' ? d : fallback
}

/**
 * Einrichtungs-Flow für 2FA (Authenticator-App oder E-Mail-Code). Nutzt den
 * aktuell gespeicherten Token (Voll-Token im Profil oder Pre-Auth-Token beim
 * erzwungenen Login). Ruft onDone mit Backup-Codes + optionalem Voll-Token auf.
 */
export default function TwoFASetup({ onDone, onCancel }: { onDone: (a: TwoFAActivated) => void; onCancel: () => void }) {
  const [stage, setStage] = useState<'choose' | 'totp' | 'email' | 'backup'>('choose')
  const [totp, setTotp] = useState<TotpSetup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [activated, setActivated] = useState<TwoFAActivated | null>(null)

  async function startTotp() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<TotpSetup>('/me/2fa/totp/setup')
      setTotp(res.data)
      setStage('totp')
    } catch (e) {
      setError(detail(e, 'Einrichtung fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  async function startEmail() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<{ success: boolean; detail: string }>('/me/2fa/email/setup')
      setInfo(res.data.detail)
      setStage('email')
    } catch (e) {
      setError(detail(e, 'Einrichtung fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(kind: 'totp' | 'email') {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<TwoFAActivated>(`/me/2fa/${kind}/confirm`, { code })
      setActivated(res.data)
      setStage('backup')
    } catch (e) {
      setError(detail(e, 'Code ist ungültig.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface p-5">
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {stage === 'choose' && (
        <>
          <h3 className="mb-1 text-base font-semibold">Zwei-Faktor-Authentifizierung einrichten</h3>
          <p className="mb-4 text-sm text-text-secondary">Wähle, wie du den zweiten Faktor erhalten möchtest.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={startTotp} disabled={busy} className="flex flex-1 items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-bg">
              <Smartphone size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block text-sm font-medium">Authenticator-App</span>
                <span className="block text-xs text-text-secondary">Zeitcodes aus einer App (empfohlen, offline).</span>
              </span>
            </button>
            <button onClick={startEmail} disabled={busy} className="flex flex-1 items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-bg">
              <Mail size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block text-sm font-medium">E-Mail-Code</span>
                <span className="block text-xs text-text-secondary">Einmalcode per E-Mail bei jeder Anmeldung.</span>
              </span>
            </button>
          </div>
          <button onClick={onCancel} className="mt-4 text-sm text-text-secondary hover:underline">Abbrechen</button>
        </>
      )}

      {stage === 'totp' && totp && (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold"><Smartphone size={18} /> Authenticator koppeln</h3>
          <p className="mb-3 text-sm text-text-secondary">
            Scanne den QR-Code mit deiner Authenticator-App und gib den angezeigten 6-stelligen Code ein.
          </p>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <img src={totp.qr_data_uri} alt="QR-Code" className="h-40 w-40 rounded-md border border-border bg-white p-1" />
            <div className="text-sm text-text-secondary">
              <p>Kein Scan möglich? Schlüssel manuell eintragen:</p>
              <code className="mt-1 block break-all rounded-md border border-border bg-bg px-2 py-1 font-mono text-xs text-text-primary">
                {totp.secret}
              </code>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              6-stelliger Code
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className={`${fieldClass} w-40 font-mono`} />
            </label>
            <button onClick={() => confirm('totp')} disabled={busy || !code} className={primaryBtn}>Aktivieren</button>
            <button onClick={onCancel} className={ghostBtn}>Abbrechen</button>
          </div>
        </>
      )}

      {stage === 'email' && (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold"><Mail size={18} /> E-Mail-Code bestätigen</h3>
          {info && <p className="mb-3 text-sm text-text-secondary">{info}</p>}
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Code aus der E-Mail
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className={`${fieldClass} w-40 font-mono`} />
            </label>
            <button onClick={() => confirm('email')} disabled={busy || !code} className={primaryBtn}>Aktivieren</button>
            <button onClick={onCancel} className={ghostBtn}>Abbrechen</button>
          </div>
        </>
      )}

      {stage === 'backup' && activated && (
        <>
          <h3 className="mb-2 flex items-center gap-2 text-base font-semibold"><KeyRound size={18} /> Backup-Codes</h3>
          <p className="mb-3 text-sm text-text-secondary">
            Bewahre diese Codes sicher auf. Jeder Code funktioniert einmal, falls du keinen Zugriff auf deinen zweiten Faktor
            hast. Sie werden <span className="font-medium text-text-primary">nur jetzt</span> angezeigt.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-bg p-3 font-mono text-sm sm:grid-cols-4">
            {activated.backup_codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button onClick={() => onDone(activated)} className={`${primaryBtn} mt-4`}>
            Ich habe die Codes gesichert
          </button>
        </>
      )}
    </div>
  )
}
