import { Blocks, CircleUser, FileText, Globe, LayoutDashboard, LogOut, Mail, Moon, Server, Settings, Sun, UserCog, Users, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useMe } from '../hooks/useMe'
import { useTheme } from '../hooks/useTheme'
import { logout } from '../services/auth'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
  badge?: string
}

const mainNav: NavItem[] = [
  { to: '/', label: 'Control-Center', icon: LayoutDashboard, end: true },
  { to: '/templates', label: 'Vorlagen', icon: FileText, end: false },
  { to: '/groups', label: 'Gruppen', icon: Users, end: false },
  { to: '/sending-profiles', label: 'Sending Profiles', icon: Server, end: false },
  { to: '/landing-pages', label: 'Landing Pages', icon: Globe, end: false },
  { to: '/campaigns', label: 'Kampagnen', icon: Mail, end: false },
]

// Fuer alle Nutzer sichtbar.
const profileNav: NavItem[] = [{ to: '/profile', label: 'Mein Profil', icon: CircleUser, end: false }]

// Nur fuer Admins. Die Einstellungsbereiche haben eine eigene zweite
// Sidebar-Spalte (siehe SettingsLayout), Netbird-Stil.
const adminNav: NavItem[] = [
  { to: '/users', label: 'Benutzer', icon: UserCog, end: false },
  { to: '/settings', label: 'Einstellungen', icon: Settings, end: false },
  { to: '/integrations', label: 'Integrationen', icon: Blocks, end: false, badge: 'Enterprise' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink key={to} to={to} end={end} className={linkClass}>
          <Icon size={16} />
          {label}
          {badge && (
            <span className="ml-auto rounded-full bg-[#16c60c] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white shadow-[0_0_6px_rgba(22,198,12,0.6)]">
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </>
  )
}

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const me = useMe()
  const isAdmin = me?.role === 'admin'

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      {/* Kopfzeile mit durchgehender Trennlinie ueber die volle Breite (Netbird-Stil). */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="h-6 w-6 rounded-md bg-accent" aria-hidden />
        <span className="text-lg font-semibold tracking-tight">HumanShield.APP</span>
      </header>

      <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-surface">
        <div>
          <nav className="flex flex-col gap-1 px-3 pt-4">
            <NavItems items={mainNav} />
          </nav>
        </div>

        <div>
          <nav className="flex flex-col gap-1 px-3">
            <NavItems items={profileNav} />
          </nav>
          {isAdmin && (
            <>
              <div className="mt-2 px-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                Verwaltung
              </div>
              <nav className="flex flex-col gap-1 px-3 pb-2">
                <NavItems items={adminNav} />
              </nav>
            </>
          )}
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
            <span>HumanShield.APP</span>
            <span className="font-mono">v0.1.0</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
      </div>
    </div>
  )
}
