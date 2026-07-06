/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Blocks, CircleUser, FileText, Globe, LayoutDashboard, LogOut, Mail, Moon, Server, Settings, Sun, UserCog, Users, type LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '../i18n'
import { useMe } from '../hooks/useMe'
import { useTheme } from '../hooks/useTheme'
import { logout } from '../services/auth'

interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  end: boolean
  badge?: string
}

const mainNav: NavItem[] = [
  { to: '/', labelKey: 'nav.controlCenter', icon: LayoutDashboard, end: true },
  { to: '/templates', labelKey: 'nav.templates', icon: FileText, end: false },
  { to: '/groups', labelKey: 'nav.groups', icon: Users, end: false },
  { to: '/sending-profiles', labelKey: 'nav.sendingProfiles', icon: Server, end: false },
  { to: '/landing-pages', labelKey: 'nav.landingPages', icon: Globe, end: false },
  { to: '/campaigns', labelKey: 'nav.campaigns', icon: Mail, end: false },
]

// Fuer alle Nutzer sichtbar.
const profileNav: NavItem[] = [{ to: '/profile', labelKey: 'nav.profile', icon: CircleUser, end: false }]

// Nur fuer Admins. Die Einstellungsbereiche haben eine eigene zweite
// Sidebar-Spalte (siehe SettingsLayout), Netbird-Stil.
const adminNav: NavItem[] = [
  { to: '/users', labelKey: 'nav.users', icon: UserCog, end: false },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, end: false },
  { to: '/integrations', labelKey: 'nav.integrations', icon: Blocks, end: false },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

function NavItems({ items }: { items: NavItem[] }) {
  const { t } = useI18n()
  return (
    <>
      {items.map(({ to, labelKey, icon: Icon, end, badge }) => (
        <NavLink key={to} to={to} end={end} className={linkClass}>
          <Icon size={16} className="shrink-0" />
          <span className="truncate">{t(labelKey)}</span>
          {badge && (
            <span className="ml-auto shrink-0 rounded-full bg-green-600 px-1.5 py-px text-[9px] font-semibold uppercase leading-normal tracking-tight text-white">
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
  const { t } = useI18n()
  const me = useMe()
  const isAdmin = me?.role === 'admin'

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      {/* Kopfzeile mit durchgehender Trennlinie ueber die volle Breite (Netbird-Stil). */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <span className="h-6 w-6 rounded-md bg-accent" aria-hidden />
        <span className="text-lg font-semibold tracking-tight">HumanShield.APP</span>
        <Link
          to="/settings/license"
          className="ml-auto rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-600/10"
        >
          {t('header.upgradeLicense')}
        </Link>
      </header>

      <div className="flex flex-1">
      <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-border bg-surface">
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
                {t('nav.administration')}
              </div>
              <nav className="flex flex-col gap-1 px-3 pb-2">
                <NavItems items={adminNav} />
              </nav>
            </>
          )}
          <div className="space-y-3 border-t border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-secondary">{t('common.language')}</span>
              <LanguageSwitcher />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={toggleTheme}
                aria-label={t('common.toggleTheme')}
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
                {t('common.logout')}
              </button>
            </div>
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
