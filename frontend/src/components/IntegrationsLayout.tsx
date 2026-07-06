/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Briefcase, Building2, LayoutGrid, Lock, type LucideIcon } from 'lucide-react'
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
// Genau zwei kostenpflichtige Add-ons: Business und Enterprise. `feature`
// verweist auf das Lizenz-Entitlement; ohne gültige Lizenz wird der Punkt als
// gesperrt markiert.
const integrationsNav: NavItem[] = [
  { to: '/integrations/overview', labelKey: 'integrations.overview', icon: LayoutGrid },
  { to: '/integrations/business', labelKey: 'integrations.business', icon: Briefcase, feature: 'business' },
  { to: '/integrations/enterprise', labelKey: 'integrations.enterprise', icon: Building2, feature: 'enterprise' },
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
