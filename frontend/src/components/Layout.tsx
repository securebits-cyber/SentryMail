/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ArrowUpCircle, Blocks, BookOpen, ChevronDown, CircleUser, ExternalLink, FileBarChart, FileText, Globe, Layers, LayoutDashboard, LogOut, Mail, Moon, Radar, Repeat, Server, Settings, Sun, UserCog, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '../i18n'
import { useFeatures } from '../hooks/useFeatures'
import { useMe } from '../hooks/useMe'
import { useVersion } from '../hooks/useVersion'
import { useTheme } from '../hooks/useTheme'
import { useBranding } from './BrandingProvider'
import TierBadge, { type Tier } from './TierBadge'
import { logout } from '../services/auth'
import { APP_VERSION } from '../version'

interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  end: boolean
  tier?: Tier
  children?: NavItem[]
}

const mainNav: NavItem[] = [
  { to: '/', labelKey: 'nav.controlCenter', icon: LayoutDashboard, end: true },
  { to: '/templates', labelKey: 'nav.templates', icon: FileText, end: false },
  { to: '/groups', labelKey: 'nav.groups', icon: Users, end: false },
  { to: '/sending-profiles', labelKey: 'nav.sendingProfiles', icon: Server, end: false },
  { to: '/landing-pages', labelKey: 'nav.landingPages', icon: Globe, end: false },
  {
    to: '/campaigns',
    labelKey: 'nav.campaigns',
    icon: Mail,
    end: false,
    children: [
      { to: '/recurring', labelKey: 'nav.recurring', icon: Repeat, end: false, tier: 'business' },
      { to: '/multistage', labelKey: 'nav.multistage', icon: Layers, end: false, tier: 'business' },
      { to: '/auto-campaigns', labelKey: 'nav.autocampaigns', icon: Radar, end: false, tier: 'enterprise' },
    ],
  },
  { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart, end: false },
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

function NavEntry({ to, labelKey, icon: Icon, end, tier }: NavItem) {
  const { t } = useI18n()
  const features = useFeatures()
  const locked = tier ? !features?.features?.[tier] : false
  return (
    <NavLink to={to} end={end} className={linkClass}>
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{t(labelKey)}</span>
      {tier && <TierBadge tier={tier} locked={locked} className="ml-auto shrink-0" />}
    </NavLink>
  )
}

/** Eltern-Eintrag mit auf-/zuklappbarem Child-Menue (klappt automatisch auf,
 *  sobald eine Route des Bereichs aktiv ist). */
function NavGroup({ item }: { item: NavItem }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const children = item.children ?? []
  const inside = [item, ...children].some((c) => pathname.startsWith(c.to))
  const [open, setOpen] = useState(inside)
  useEffect(() => {
    if (inside) setOpen(true)
  }, [inside])

  return (
    <div>
      <div className="flex items-center gap-1">
        <NavLink to={item.to} end={item.end} className={(p) => `${linkClass(p)} flex-1`}>
          <item.icon size={16} className="shrink-0" />
          <span className="truncate">{t(item.labelKey)}</span>
        </NavLink>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t(item.labelKey)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg hover:text-text-primary"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-border pl-2">
          {children.map((c) => (
            <NavEntry key={c.to} {...c} />
          ))}
        </div>
      )}
    </div>
  )
}

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) =>
        item.children?.length ? <NavGroup key={item.to} item={item} /> : <NavEntry key={item.to} {...item} />,
      )}
    </>
  )
}

export default function Layout() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const me = useMe()
  const branding = useBranding()
  const version = useVersion()
  const isAdmin = me?.role === 'admin'
  // Wiki-Ziel konfigurierbar (vendor-neutral); Default: Projekt-Wiki auf GitHub.
  const wikiUrl = import.meta.env.VITE_WIKI_URL || 'https://github.com/securebitsorg/HumanShield.APP/wiki'

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      {/* Kopfzeile mit durchgehender Trennlinie ueber die volle Breite (Netbird-Stil). */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-3">
        {branding.logo_b64 ? (
          <img src={branding.logo_b64} alt="" className="h-7 max-w-[140px] object-contain" />
        ) : (
          <span className="h-6 w-6 rounded-md bg-accent" aria-hidden />
        )}
        <span className="text-lg font-semibold tracking-tight">{branding.app_name}</span>
        <span className="mx-auto hidden select-none text-sm font-medium tracking-wide text-text-secondary sm:block">
          {t('header.slogan')}
        </span>
        <Link
          to="/settings/license"
          className="ml-auto rounded-md border border-green-600 px-3 py-1.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-600/10 sm:ml-0"
        >
          {t('header.upgradeLicense')}
        </Link>
      </header>

      <div className="flex flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div>
          <nav className="flex flex-col gap-1 px-3 pt-4">
            <NavItems items={mainNav} />
          </nav>
        </div>

        <div>
          {/* Trennlinie: Workflow oben, Profil/Verwaltung/Einstellungen unten. */}
          <div className="mb-2 mt-4 border-t border-border" />
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

          <div className="mx-3 mb-2 space-y-2">
            <div className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-xs text-text-secondary">
              <span>{branding.app_name}</span>
              <span className="font-mono">v{version?.current ?? APP_VERSION}</span>
            </div>
            {version?.update_available && version.changelog_url && (
              <a
                href={version.changelog_url}
                target="_blank"
                rel="noreferrer"
                title={version.latest ? `v${version.latest}` : undefined}
                className="flex items-center justify-between gap-2 rounded-md border border-accent bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              >
                <span className="flex items-center gap-1.5">
                  <ArrowUpCircle size={14} className="shrink-0" />
                  {t('update.available')}
                </span>
                <span className="flex items-center gap-1">
                  {t('update.changelog')}
                  <ExternalLink size={12} className="shrink-0" />
                </span>
              </a>
            )}
          </div>

          {/* Wiki-Button, volle Breite des Sidebar-Bereichs. */}
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-bg"
          >
            <BookOpen size={16} />
            {t('nav.wiki')}
          </a>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
      </div>
    </div>
  )
}
