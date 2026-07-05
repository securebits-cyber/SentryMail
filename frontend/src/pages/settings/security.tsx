import { Settings, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import PageScaffold from '../../components/PageScaffold'
import { api } from '../../services/api'
import type { SecurityConfig } from '../../types'

const options = [
  { value: 'off', label: 'Freiwillig', desc: 'Jeder Nutzer entscheidet selbst, ob 2FA aktiviert wird.' },
  { value: 'admins', label: 'Für Admins verpflichtend', desc: 'Admin-Konten müssen 2FA einrichten (beim nächsten Login erzwungen).' },
  { value: 'all', label: 'Für alle verpflichtend', desc: 'Alle Konten müssen 2FA einrichten (beim nächsten Login erzwungen).' },
]

export default function SecuritySettingsPage() {
  const [value, setValue] = useState<string>('off')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    api
      .get<SecurityConfig>('/settings/security')
      .then((res) => setValue(res.data.require_2fa))
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/settings/security', { require_2fa: value })
      setMessage({ kind: 'info', text: 'Sicherheitseinstellungen gespeichert.' })
    } catch {
      setMessage({ kind: 'error', text: 'Speichern fehlgeschlagen (Admin-Rechte nötig?).' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageScaffold
      title="Sicherheit"
      subtitle="Steuert, ob Zwei-Faktor-Authentifizierung verpflichtend ist."
      breadcrumb={[
        { label: 'Einstellungen', icon: Settings },
        { label: 'Sicherheit', icon: ShieldCheck },
      ]}
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {!loaded ? (
        <p className="text-text-secondary">Lade Einstellungen...</p>
      ) : (
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="text-sm font-medium">2FA-Pflicht</div>
          <div className="flex flex-col gap-2">
            {options.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${
                  value === opt.value ? 'border-accent bg-accent/8' : 'border-border bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="require_2fa"
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-sm text-text-secondary">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-text-secondary">
            Bei aktivierter Pflicht werden betroffene Nutzer beim nächsten Login zur Einrichtung geführt. Bereits
            angemeldete Sitzungen bleiben bis zum nächsten Login gültig.
          </p>
          <div>
            <button onClick={save} disabled={saving} className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </PageScaffold>
  )
}
