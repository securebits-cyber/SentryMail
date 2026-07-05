import { Brain, Building2, LayoutGrid, Palette, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: string
}

// Integrationsbereiche als Unterpunkte (gleiches Prinzip wie SettingsLayout:
// eigene zweite Sidebar-Spalte). Enterprise-Features sind entsprechend markiert.
const integrationsNav: NavItem[] = [
  { to: '/integrations/overview', label: 'Übersicht', icon: LayoutGrid },
  { to: '/integrations/white-label', label: 'White-Label', icon: Palette, badge: 'Enterprise' },
  { to: '/integrations/multi-tenant', label: 'Multi-Tenant', icon: Building2, badge: 'Enterprise' },
  { to: '/integrations/ai-scoring', label: 'AI-Scoring', icon: Brain, badge: 'Enterprise' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

export default function IntegrationsLayout() {
  return (
    <div className="-m-6 flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-border bg-surface px-3 py-5">
        <nav className="flex flex-col gap-1">
          {integrationsNav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{label}</span>
              {badge && (
                <span className="ml-auto shrink-0 rounded-full bg-green-600 px-1.5 py-px text-[9px] font-semibold uppercase leading-normal tracking-tight text-white">
                  {badge}
                </span>
              )}
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
