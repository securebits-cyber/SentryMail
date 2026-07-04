/**
 * Auth-Helper: lokaler Login (primaer) sowie optionaler OIDC-Flow (Zweitmethode).
 * OIDC ist ein Full-Page-Redirect zu Backend -> OIDC-Provider. Nach dem Callback
 * liefert das Backend das Session-JWT im URL-Fragment zurueck (nicht als
 * Query-Parameter, damit es nicht in Zugriffslogs landet).
 */
const TOKEN_STORAGE_KEY = 'phishaware-token'

const apiUrl = import.meta.env.VITE_API_URL

export function loginUrl(): string {
  return `${apiUrl}/auth/login`
}

export async function getAuthConfig(): Promise<{ oidc_enabled: boolean }> {
  const response = await fetch(`${apiUrl}/auth/config`)
  if (!response.ok) return { oidc_enabled: false }
  return response.json()
}

export async function loginLocal(email: string, password: string): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/local/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error('E-Mail oder Passwort ist falsch')
  }
  const data: { access_token: string } = await response.json()
  setToken(data.access_token)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function logout(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

/** Liest ein Token aus dem URL-Fragment (nach OIDC-Callback) und speichert es. */
export function consumeTokenFromUrlFragment(): boolean {
  const hash = window.location.hash
  if (!hash.startsWith('#token=')) return false

  const token = decodeURIComponent(hash.slice('#token='.length))
  setToken(token)
  window.history.replaceState(null, '', window.location.pathname)
  return true
}
