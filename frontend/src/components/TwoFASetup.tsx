/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { KeyRound, Mail, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { TotpSetup, TwoFAActivated } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const primaryBtn = 'rounded-md bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60'
const ghostBtn = 'rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg'

function detail(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof d === 'string' ? d : fallback
}

/**
 * Einrichtungs-Flow für 2FA (Authenticator-App oder E-Mail-Code). Nutzt den
 * aktuell gespeicherten Token (Voll-Token im Profil oder Pre-Auth-Token beim
 * erzwungenen Login). Ruft onDone mit Backup-Codes + optionalem Voll-Token auf.
 */
export default function TwoFASetup({ onDone, onCancel }: { onDone: (a: TwoFAActivated) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [stage, setStage] = useState<'choose' | 'totp' | 'email' | 'backup'>('choose')
  const [totp, setTotp] = useState<TotpSetup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [activated, setActivated] = useState<TwoFAActivated | null>(null)

  async function startTotp() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<TotpSetup>('/me/2fa/totp/setup')
      setTotp(res.data)
      setStage('totp')
    } catch (e) {
      setError(detail(e, t('tfa.err.setup')))
    } finally {
      setBusy(false)
    }
  }

  async function startEmail() {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<{ success: boolean; detail: string }>('/me/2fa/email/setup')
      setInfo(res.data.detail)
      setStage('email')
    } catch (e) {
      setError(detail(e, t('tfa.err.setup')))
    } finally {
      setBusy(false)
    }
  }

  async function confirm(kind: 'totp' | 'email') {
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<TwoFAActivated>(`/me/2fa/${kind}/confirm`, { code })
      setActivated(res.data)
      setStage('backup')
    } catch (e) {
      setError(detail(e, t('login.2fa.errorCode')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl rounded-lg border border-border bg-surface p-5">
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      {stage === 'choose' && (
        <>
          <h3 className="mb-1 text-base font-semibold">{t('tfa.title')}</h3>
          <p className="mb-4 text-sm text-text-secondary">{t('tfa.choose')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={startTotp} disabled={busy} className="flex flex-1 items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-bg">
              <Smartphone size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block text-sm font-medium">{t('prof.2fa.methodTotp')}</span>
                <span className="block text-xs text-text-secondary">{t('tfa.totpDesc')}</span>
              </span>
            </button>
            <button onClick={startEmail} disabled={busy} className="flex flex-1 items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-bg">
              <Mail size={20} className="mt-0.5 text-accent" />
              <span>
                <span className="block text-sm font-medium">{t('prof.2fa.methodEmail')}</span>
                <span className="block text-xs text-text-secondary">{t('tfa.emailDesc')}</span>
              </span>
            </button>
          </div>
          <button onClick={onCancel} className="mt-4 text-sm text-text-secondary hover:underline">{t('common.cancel')}</button>
        </>
      )}

      {stage === 'totp' && totp && (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold"><Smartphone size={18} /> {t('tfa.pair')}</h3>
          <p className="mb-3 text-sm text-text-secondary">{t('tfa.scan')}</p>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <img src={totp.qr_data_uri} alt={t('tfa.qrAlt')} className="h-40 w-40 rounded-md border border-border bg-white p-1" />
            <div className="text-sm text-text-secondary">
              <p>{t('tfa.manual')}</p>
              <code className="mt-1 block break-all rounded-md border border-border bg-bg px-2 py-1 font-mono text-xs text-text-primary">
                {totp.secret}
              </code>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('tfa.code6')}
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className={`${fieldClass} w-40 font-mono`} />
            </label>
            <button onClick={() => confirm('totp')} disabled={busy || !code} className={primaryBtn}>{t('tfa.activate')}</button>
            <button onClick={onCancel} className={ghostBtn}>{t('common.cancel')}</button>
          </div>
        </>
      )}

      {stage === 'email' && (
        <>
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold"><Mail size={18} /> {t('tfa.emailConfirm')}</h3>
          {info && <p className="mb-3 text-sm text-text-secondary">{info}</p>}
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('tfa.emailCode')}
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className={`${fieldClass} w-40 font-mono`} />
            </label>
            <button onClick={() => confirm('email')} disabled={busy || !code} className={primaryBtn}>{t('tfa.activate')}</button>
            <button onClick={onCancel} className={ghostBtn}>{t('common.cancel')}</button>
          </div>
        </>
      )}

      {stage === 'backup' && activated && (
        <>
          <h3 className="mb-2 flex items-center gap-2 text-base font-semibold"><KeyRound size={18} /> {t('tfa.backupTitle')}</h3>
          <p className="mb-3 text-sm text-text-secondary">{t('tfa.backupNote')}</p>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-bg p-3 font-mono text-sm sm:grid-cols-4">
            {activated.backup_codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button onClick={() => onDone(activated)} className={`${primaryBtn} mt-4`}>
            {t('tfa.backupDone')}
          </button>
        </>
      )}
    </div>
  )
}
