// Übersetzungen für das Dashboard (DE/EN). Flache, sprechende Schlüssel.
// Neue Strings hier ergänzen; fehlt ein Schlüssel in EN, greift automatisch DE.

export type Lang = 'de' | 'en'

export const translations: Record<Lang, Record<string, string>> = {
  de: {
    // Navigation
    'nav.controlCenter': 'Control-Center',
    'nav.templates': 'Vorlagen',
    'nav.groups': 'Gruppen',
    'nav.sendingProfiles': 'Sending Profiles',
    'nav.landingPages': 'Landing Pages',
    'nav.campaigns': 'Kampagnen',
    'nav.profile': 'Mein Profil',
    'nav.users': 'Benutzer',
    'nav.settings': 'Einstellungen',
    'nav.integrations': 'Integrationen',
    'nav.administration': 'Verwaltung',

    // Kopfzeile / allgemein
    'header.upgradeLicense': 'Upgrade Lizenz',
    'common.logout': 'Logout',
    'common.toggleTheme': 'Farbmodus umschalten',
    'common.language': 'Sprache',
    'badge.enterprise': 'Enterprise',
  },
  en: {
    // Navigation
    'nav.controlCenter': 'Control Center',
    'nav.templates': 'Templates',
    'nav.groups': 'Groups',
    'nav.sendingProfiles': 'Sending Profiles',
    'nav.landingPages': 'Landing Pages',
    'nav.campaigns': 'Campaigns',
    'nav.profile': 'My Profile',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'nav.integrations': 'Integrations',
    'nav.administration': 'Administration',

    // Header / common
    'header.upgradeLicense': 'Upgrade License',
    'common.logout': 'Log out',
    'common.toggleTheme': 'Toggle color mode',
    'common.language': 'Language',
    'badge.enterprise': 'Enterprise',
  },
}
