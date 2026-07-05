import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthConfig, loginLocal, loginUrl } from '../services/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [oidcEnabled, setOidcEnabled] = useState(false)

  useEffect(() => {
    getAuthConfig().then((config) => setOidcEnabled(config.oidc_enabled))
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await loginLocal(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('E-Mail oder Passwort ist falsch.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg text-text-primary">
      <h1 className="text-2xl font-semibold">HumanShield.APP</h1>

      <form onSubmit={handleSubmit} className="flex w-72 flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          E-Mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="rounded-md border border-border bg-surface px-3 py-2 text-text-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-border bg-surface px-3 py-2 text-text-primary"
          />
        </label>

        {error && <p className="m-0 text-sm text-status-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Wird geprueft...' : 'Anmelden'}
        </button>
      </form>

      {oidcEnabled && (
        <a href={loginUrl()} className="text-sm text-text-secondary underline">
          Mit Single Sign-On anmelden
        </a>
      )}
    </div>
  )
}
