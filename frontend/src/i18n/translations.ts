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
    'common.back': 'Zurück',
    'badge.enterprise': 'Enterprise',

    // Login
    'login.email': 'E-Mail',
    'login.password': 'Passwort',
    'login.signIn': 'Anmelden',
    'login.checking': 'Wird geprüft...',
    'login.errorCredentials': 'E-Mail oder Passwort ist falsch.',
    'login.sso': 'Mit Single Sign-On anmelden',
    'login.2fa.emailSent': 'Wir haben dir einen Einmalcode per E-Mail geschickt.',
    'login.2fa.appPrompt': 'Gib den Code aus deiner Authenticator-App ein.',
    'login.2fa.backupHint': 'Alternativ funktioniert ein Backup-Code.',
    'login.2fa.codeLabel': 'Code',
    'login.2fa.errorCode': 'Code ist ungültig.',
    'login.2fa.checking': 'Prüfe...',
    'login.2fa.confirm': 'Bestätigen',
    'login.2fa.setupRequired':
      'Für dein Konto ist Zwei-Faktor-Authentifizierung verpflichtend. Bitte richte sie jetzt ein.',

    // Einstellungen (Untermenü)
    'settings.ldap': 'LDAP',
    'settings.oidc': 'OIDC / SSO',
    'settings.smtp': 'SMTP',
    'settings.security': 'Sicherheit',
    'settings.license': 'Lizenz',
    'settings.activity': 'Aktivität',
    'settings.auditEvents': 'Audit Events',

    // Integrationen (Untermenü)
    'integrations.overview': 'Übersicht',
    'integrations.whiteLabel': 'White-Label',
    'integrations.multiTenant': 'Multi-Tenant',
    'integrations.aiScoring': 'AI-Scoring',
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
    'common.back': 'Back',
    'badge.enterprise': 'Enterprise',

    // Login
    'login.email': 'Email',
    'login.password': 'Password',
    'login.signIn': 'Sign in',
    'login.checking': 'Checking...',
    'login.errorCredentials': 'Incorrect email or password.',
    'login.sso': 'Sign in with single sign-on',
    'login.2fa.emailSent': 'We have sent you a one-time code by email.',
    'login.2fa.appPrompt': 'Enter the code from your authenticator app.',
    'login.2fa.backupHint': 'A backup code works as well.',
    'login.2fa.codeLabel': 'Code',
    'login.2fa.errorCode': 'Invalid code.',
    'login.2fa.checking': 'Verifying...',
    'login.2fa.confirm': 'Confirm',
    'login.2fa.setupRequired':
      'Two-factor authentication is required for your account. Please set it up now.',

    // Settings (submenu)
    'settings.ldap': 'LDAP',
    'settings.oidc': 'OIDC / SSO',
    'settings.smtp': 'SMTP',
    'settings.security': 'Security',
    'settings.license': 'License',
    'settings.activity': 'Activity',
    'settings.auditEvents': 'Audit Events',

    // Integrations (submenu)
    'integrations.overview': 'Overview',
    'integrations.whiteLabel': 'White-Label',
    'integrations.multiTenant': 'Multi-Tenant',
    'integrations.aiScoring': 'AI-Scoring',
  },
}
