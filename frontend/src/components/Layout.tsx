import { Moon, Sun } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { logout } from '../services/auth'

export default function Layout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-md)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-subtle)',
        }}
      >
        <nav style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/campaigns">Kampagnen</NavLink>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <button
            onClick={toggleTheme}
            aria-label="Farbmodus umschalten"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              color: 'var(--color-fg)',
              cursor: 'pointer',
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={logout}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--color-fg)',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: 'var(--space-lg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
