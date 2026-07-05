import { KeyRound, MailCheck, Network } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

// Einstellungsbereiche — neue Bereiche hier ergaenzen (Netbird-Stil:
// eigene zweite Sidebar-Spalte neben der Hauptnavigation).
const settingsNav = [
  { to: '/settings/ldap', label: 'LDAP', icon: Network },
  { to: '/settings/oidc', label: 'OIDC / SSO', icon: KeyRound },
  { to: '/settings/smtp', label: 'SMTP', icon: MailCheck },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

export default function SettingsLayout() {
  return (
    <div className="-m-6 flex min-h-full">
      <aside className="w-52 shrink-0 border-r border-border bg-surface px-3 py-5">
        <nav className="flex flex-col gap-1">
          {settingsNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Die Seite selbst rendert ein PageScaffold, das mit -m-6 wieder ausbricht. */}
      <div className="min-w-0 flex-1 p-6">
        <Outlet />
      </div>
    </div>
  )
}
