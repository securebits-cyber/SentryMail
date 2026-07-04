import { useEffect, useState } from 'react'
import SendingProfileForm, { SendingProfileFormValues } from '../components/SendingProfileForm'
import { api } from '../services/api'
import type { SendingProfile } from '../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; profile: SendingProfile }

export default function SendingProfilesPage() {
  const [profiles, setProfiles] = useState<SendingProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function load() {
    setLoading(true)
    api
      .get<SendingProfile[]>('/sending-profiles')
      .then((res) => setProfiles(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleSubmit(values: SendingProfileFormValues) {
    setSubmitting(true)
    setMessage(null)
    try {
      if (mode.kind === 'edit') {
        await api.patch(`/sending-profiles/${mode.profile.id}`, values)
      } else {
        await api.post('/sending-profiles', values)
      }
      setMode({ kind: 'list' })
      load()
    } catch {
      setMessage({ kind: 'error', text: 'Profil konnte nicht gespeichert werden (Admin-Rechte nötig?).' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(profile: SendingProfile) {
    if (!window.confirm(`Profil „${profile.name}“ wirklich löschen?`)) return
    setMessage(null)
    try {
      await api.delete(`/sending-profiles/${profile.id}`)
      load()
    } catch {
      setMessage({ kind: 'error', text: 'Profil konnte nicht gelöscht werden.' })
    }
  }

  async function handleTest(profile: SendingProfile) {
    const email = window.prompt(`Test-Mail über „${profile.name}“ senden an:`)
    if (!email) return
    setMessage({ kind: 'info', text: 'Test-Mail wird gesendet...' })
    try {
      const res = await api.post<{ success: boolean; detail: string }>(
        `/sending-profiles/${profile.id}/test`,
        { email },
      )
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: 'Test-Mail fehlgeschlagen (Admin-Rechte nötig?).' })
    }
  }

  if (mode.kind !== 'list') {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold">
          {mode.kind === 'edit' ? 'Sending Profile bearbeiten' : 'Neues Sending Profile'}
        </h1>
        {message && (
          <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
            {message.text}
          </p>
        )}
        <SendingProfileForm
          initial={mode.kind === 'edit' ? mode.profile : null}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode({ kind: 'list' })
            setMessage(null)
          }}
          submitting={submitting}
        />
      </>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sending Profiles</h1>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Neues Profil
        </button>
      </div>

      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-text-secondary">Lade Profile...</p>
      ) : profiles.length === 0 ? (
        <p className="text-text-secondary">Noch kein Sending Profile vorhanden &rarr; Erstes Profil anlegen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Host</th>
                <th className="py-2 pr-4 font-medium">Absender</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-border">
                  <td className="py-2 pr-4">{profile.name}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {profile.host}:{profile.port}
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">{profile.from_email}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleTest(profile)} className="mr-3 text-accent hover:underline">
                      Test-Mail
                    </button>
                    <button
                      onClick={() => setMode({ kind: 'edit', profile })}
                      className="mr-3 text-accent hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button onClick={() => handleDelete(profile)} className="text-status-danger hover:underline">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
