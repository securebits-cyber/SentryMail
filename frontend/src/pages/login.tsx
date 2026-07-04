import { loginUrl } from '../services/auth'

export default function LoginPage() {
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
      <a
        href={loginUrl()}
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-accent-fg)',
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          textDecoration: 'none',
        }}
      >
        Mit Single Sign-On anmelden
      </a>
    </div>
  )
}
