import { Brain, Building2, LayoutGrid, Lock, Palette, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'

interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  feature?: string
}

// Integrationsbereiche als Unterpunkte (gleiches Prinzip wie SettingsLayout:
// eigene zweite Sidebar-Spalte). `feature` verweist auf das Add-on-Entitlement;
// ohne gueltige Lizenz wird der Punkt als gesperrt markiert.
const integrationsNav: NavItem[] = [
  { to: '/integrations/overview', labelKey: 'integrations.overview', icon: LayoutGrid },
  { to: '/integrations/white-label', labelKey: 'integrations.whiteLabel', icon: Palette, feature: 'white_label' },
  { to: '/integrations/multi-tenant', labelKey: 'integrations.multiTenant', icon: Building2, feature: 'multi_tenant' },
  { to: '/integrations/ai-scoring', labelKey: 'integrations.aiScoring', icon: Brain, feature: 'ai_scoring' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

export default function IntegrationsLayout() {
  const features = useFeatures()
  const { t } = useI18n()

  return (
    <div className="-m-6 flex min-h-full">
      <aside className="w-64 shrink-0 border-r border-border bg-surface px-3 py-5">
        <nav className="flex flex-col gap-1">
          {integrationsNav.map(({ to, labelKey, icon: Icon, feature }) => {
            const active = feature ? Boolean(features?.features?.[feature]) : true
            return (
              <NavLink key={to} to={to} className={linkClass}>
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{t(labelKey)}</span>
                {feature &&
                  (active ? (
                    <span className="ml-auto shrink-0 rounded-full bg-green-600 px-1.5 py-px text-[9px] font-semibold uppercase leading-normal tracking-tight text-white">
                      Aktiv
                    </span>
                  ) : (
                    <Lock size={13} className="ml-auto shrink-0 text-text-secondary" />
                  ))}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* Die Seite selbst rendert ein PageScaffold, das mit -m-6 wieder ausbricht. */}
      <div className="min-w-0 flex-1 p-6">
        <Outlet />
      </div>
    </div>
  )
}
