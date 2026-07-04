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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <h1>PhishAware</h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: 280 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          E-Mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p style={{ color: 'var(--color-danger)', margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {submitting ? 'Wird geprueft...' : 'Anmelden'}
        </button>
      </form>

      {oidcEnabled && (
        <a
          href={loginUrl()}
          style={{
            color: 'var(--color-fg-muted)',
            textDecoration: 'underline',
          }}
        >
          Mit Single Sign-On anmelden
        </a>
      )}
    </div>
  )
}
