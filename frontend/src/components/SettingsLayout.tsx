/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { BadgeCheck, Cloud, KeyRound, KeySquare, Lock, MailCheck, Network, Palette, ScrollText, Share2, ShieldCheck, Sparkles, Webhook, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import TierBadge from './TierBadge'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'

interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  feature?: 'business' | 'enterprise'
}

// Einstellungs-Nav in Gruppen (Netbird-Stil). Neue Bereiche hier ergaenzen.
// `feature` verweist auf ein Lizenz-Entitlement; ohne gültige Lizenz gesperrt.
const groups: { labelKey: string | null; items: NavItem[] }[] = [
  {
    labelKey: null,
    items: [
      { to: '/settings/ldap', labelKey: 'settings.ldap', icon: Network, feature: 'business' },
      { to: '/settings/webhooks', labelKey: 'settings.webhooks', icon: Webhook, feature: 'business' },
      { to: '/settings/entra', labelKey: 'settings.entra', icon: Cloud, feature: 'business' },
      { to: '/settings/ai', labelKey: 'settings.ai', icon: Sparkles, feature: 'business' },
      { to: '/settings/whitelabel', labelKey: 'settings.whitelabel', icon: Palette, feature: 'enterprise' },
      { to: '/settings/siem', labelKey: 'settings.siem', icon: Share2, feature: 'enterprise' },
      { to: '/settings/saml', labelKey: 'settings.saml', icon: KeySquare, feature: 'enterprise' },
      { to: '/settings/oidc', labelKey: 'settings.oidc', icon: KeyRound },
      { to: '/settings/smtp', labelKey: 'settings.smtp', icon: MailCheck },
      { to: '/settings/security', labelKey: 'settings.security', icon: ShieldCheck },
      { to: '/settings/license', labelKey: 'settings.license', icon: BadgeCheck },
    ],
  },
  {
    labelKey: 'settings.activity',
    items: [{ to: '/settings/audit-events', labelKey: 'settings.auditEvents', icon: ScrollText }],
  },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent/12 font-medium text-accent'
      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
  }`

export default function SettingsLayout() {
  const { t } = useI18n()
  const features = useFeatures()
  return (
    <div className="-m-6 flex min-h-full">
      <aside className="w-52 shrink-0 border-r border-border bg-surface px-3 py-5">
        <nav className="flex flex-col gap-1">
          {groups.map((group, i) => (
            <div key={group.labelKey ?? i} className={group.labelKey ? 'mt-4' : ''}>
              {group.labelKey && (
                <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {t(group.labelKey)}
                </div>
              )}
              {group.items.map(({ to, labelKey, icon: Icon, feature }) => {
                const locked = feature ? !features?.features?.[feature] : false
                return (
                  <NavLink key={to} to={to} className={linkClass}>
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{t(labelKey)}</span>
                    {feature && locked && (
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        <TierBadge tier={feature} />
                        <Lock size={13} className="text-text-secondary" />
                      </span>
                    )}
                  </NavLink>
                )
              })}
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
