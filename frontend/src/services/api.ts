/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // Die Session läuft über ein httpOnly-Cookie -> Cookies immer mitsenden.
  withCredentials: true,
})

// Übergangs-Bearer: nur für die erzwungene 2FA-Einrichtung, solange noch keine
// volle Session besteht. Wird ausschließlich im Speicher gehalten (nie persistiert)
// und nach Abschluss wieder geleert.
let authBearer: string | null = null

export function setAuthBearer(token: string | null): void {
  authBearer = token
}

/** Liest das (nicht-httpOnly) CSRF-Cookie für das Double-Submit-Verfahren. */
export function csrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)hs_csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

api.interceptors.request.use((config) => {
  if (authBearer) {
    config.headers.Authorization = `Bearer ${authBearer}`
  }
  const method = (config.method ?? 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = csrfToken()
    if (token) config.headers['X-CSRF-Token'] = token
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)
