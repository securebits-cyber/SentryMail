import { KeyRound, MailCheck, Network, ScrollText, ShieldCheck, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

// Einstellungs-Nav in Gruppen (Netbird-Stil). Neue Bereiche hier ergaenzen.
const groups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { to: '/settings/ldap', label: 'LDAP', icon: Network },
      { to: '/settings/oidc', label: 'OIDC / SSO', icon: KeyRound },
      { to: '/settings/smtp', label: 'SMTP', icon: MailCheck },
      { to: '/settings/security', label: 'Sicherheit', icon: ShieldCheck },
    ],
  },
  {
    label: 'Aktivität',
    items: [{ to: '/settings/audit-events', label: 'Audit Events', icon: ScrollText }],
  },
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
          {groups.map((group, i) => (
            <div key={group.label ?? i} className={group.label ? 'mt-4' : ''}>
              {group.label && (
                <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {group.label}
                </div>
              )}
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={linkClass}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
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
