import { CircleUser, FileText, Globe, LayoutDashboard, LogOut, Mail, Moon, Server, Settings, Sun, UserCog, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { logout } from '../services/auth'

const mainNav = [
  { to: '/', label: 'Control-Center', icon: LayoutDashboard, end: true },
  { to: '/templates', label: 'Vorlagen', icon: FileText, end: false },
  { to: '/groups', label: 'Gruppen', icon: Users, end: false },
  { to: '/sending-profiles', label: 'Sending Profiles', icon: Server, end: false },
  { to: '/landing-pages', label: 'Landing Pages', icon: Globe, end: false },
  { to: '/campaigns', label: 'Kampagnen', icon: Mail, end: false },
]

// Am unteren Rand der Sidebar, getrennt vom Haupt-Workflow (Admin-Bereich).
const bottomNav = [
  { to: '/profile', label: 'Mein Profil', icon: CircleUser, end: false },
  { to: '/users', label: 'Benutzer', icon: UserCog, end: false },
  { to: '/settings', label: 'Einstellungen', icon: Settings, end: false },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

function NavItems({ items }: { items: typeof mainNav }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={linkClass}>
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </>
  )
}

export default function Layout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-surface">
        <div>
          <div className="flex items-center gap-2 px-4 py-5">
            <span className="h-6 w-6 rounded-md bg-accent" aria-hidden />
            <span className="text-lg font-semibold tracking-tight">PhishAware</span>
          </div>
          <nav className="flex flex-col gap-1 px-3">
            <NavItems items={mainNav} />
          </nav>
        </div>

        <div>
          <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
            Verwaltung
          </div>
          <nav className="flex flex-col gap-1 px-3 pb-2">
            <NavItems items={bottomNav} />
          </nav>
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <button
              onClick={toggleTheme}
              aria-label="Farbmodus umschalten"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-primary hover:bg-bg"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => {
                logout()
                window.location.assign('/login')
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-bg"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>

          <div className="mx-3 mb-3 flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
            <span>PhishAware</span>
            <span className="font-mono">v0.1.0</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
