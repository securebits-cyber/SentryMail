/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Auth-Helper: lokaler Login (primaer) sowie optionaler OIDC/SAML-Flow.
 * Die Session liegt in einem httpOnly-Cookie (nicht per JS lesbar, schützt vor
 * Token-Diebstahl via XSS); zusätzlich ein lesbares CSRF-Cookie (Double-Submit).
 * OIDC/SAML setzen das Cookie serverseitig und leiten ohne Token in der URL zurück.
 */
import { csrfToken } from './api'

const apiUrl = import.meta.env.VITE_API_URL

export function loginUrl(): string {
  return `${apiUrl}/auth/login`
}

export function samlLoginUrl(): string {
  return `${apiUrl}/auth/saml/login`
}

export async function getAuthConfig(): Promise<{ oidc_enabled: boolean }> {
  const response = await fetch(`${apiUrl}/auth/config`)
  if (!response.ok) return { oidc_enabled: false }
  return response.json()
}

/** SAML ist ein Enterprise-Add-on-Endpunkt; ohne Add-on/Config ist er nicht da. */
export async function getSamlConfig(): Promise<{ saml_enabled: boolean }> {
  try {
    const response = await fetch(`${apiUrl}/auth/saml/config`)
    if (!response.ok) return { saml_enabled: false }
    return response.json()
  } catch {
    return { saml_enabled: false }
  }
}

export interface LoginResult {
  twofa_required: boolean
  setup_required: boolean
  method: string | null
  pre_auth_token: string | null
  access_token: string | null
  token_type: string
}

/** Schritt 1: E-Mail/Passwort. Bei Erfolg setzt der Server das Session-Cookie. */
export async function loginLocal(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${apiUrl}/auth/local/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error('E-Mail oder Passwort ist falsch')
  }
  return response.json()
}

/** Schritt 2 (Passkey): Optionen für die WebAuthn-Anmeldung holen. */
export async function loginPasskeyOptions(preAuthToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${apiUrl}/auth/local/login/passkey/options`, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${preAuthToken}` },
  })
  if (!response.ok) {
    throw new Error('Passkey-Anmeldung nicht verfügbar')
  }
  return response.json()
}

/** Schritt 2 (Passkey): signierte Assertion prüfen; der Server setzt das Cookie. */
export async function loginPasskeyVerify(preAuthToken: string, credential: unknown): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/local/login/passkey/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${preAuthToken}` },
    body: JSON.stringify({ credential }),
  })
  if (!response.ok) {
    throw new Error('Passkey-Signatur ungültig')
  }
}

/** Schritt 2: 2FA-Code oder Backup-Code mit dem Pre-Auth-Token bestaetigen. */
export async function loginVerify2fa(preAuthToken: string, code: string): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/local/login/2fa`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${preAuthToken}` },
    body: JSON.stringify({ code }),
  })
  if (!response.ok) {
    throw new Error('Code ist ungültig')
  }
}

/** Angemeldet, wenn das lesbare CSRF-Cookie vorhanden ist (das Session-Cookie ist
 *  httpOnly und daher nicht direkt aus JS prüfbar). */
export function isAuthenticated(): boolean {
  return /(?:^|;\s*)hs_csrf=/.test(document.cookie)
}

/** Meldet ab: löscht die Session serverseitig (Cookie) und leitet zum Login. */
export async function logout(): Promise<void> {
  try {
    await fetch(`${apiUrl}/auth/local/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrfToken() ?? '' },
    })
  } catch {
    /* auch bei Fehler zum Login weiterleiten */
  }
  window.location.assign('/login')
}
