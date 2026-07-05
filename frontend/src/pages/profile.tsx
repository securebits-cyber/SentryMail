import { ShieldCheck } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import PageScaffold from '../components/PageScaffold'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter'
import TwoFASetup from '../components/TwoFASetup'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { TwoFAStatus, User } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

function errText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export default function ProfilePage() {
  const { t } = useI18n()
  const [me, setMe] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  // 2FA
  const [twofa, setTwofa] = useState<TwoFAStatus | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [twofaPw, setTwofaPw] = useState('')
  const [newBackup, setNewBackup] = useState<string[] | null>(null)
  const [twofaMsg, setTwofaMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function loadTwofa() {
    api.get<TwoFAStatus>('/me/2fa').then((res) => setTwofa(res.data))
  }

  useEffect(() => {
    api.get<User>('/me').then((res) => {
      setMe(res.data)
      setFullName(res.data.full_name)
    })
    loadTwofa()
  }, [])

  async function saveName(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    try {
      const res = await api.patch<User>('/me', { full_name: fullName })
      setMe(res.data)
      setMessage({ kind: 'info', text: t('prof.saved') })
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, t('prof.err.save')) })
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    if (newPw !== newPw2) {
      setMessage({ kind: 'error', text: t('prof.pw.mismatch') })
      return
    }
    try {
      await api.patch('/me', { current_password: currentPw, new_password: newPw })
      setCurrentPw('')
      setNewPw('')
      setNewPw2('')
      setMessage({ kind: 'info', text: t('prof.pw.changed') })
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, t('prof.pw.err')) })
    }
  }

  async function disableTwofa() {
    setTwofaMsg(null)
    try {
      await api.post('/me/2fa/disable', { password: twofaPw })
      setTwofaPw('')
      setNewBackup(null)
      loadTwofa()
      setTwofaMsg({ kind: 'info', text: t('prof.2fa.disabled') })
    } catch (e) {
      setTwofaMsg({ kind: 'error', text: errText(e, t('prof.2fa.disableErr')) })
    }
  }

  async function regenerateBackup() {
    setTwofaMsg(null)
    try {
      const res = await api.post<{ backup_codes: string[] }>('/me/2fa/backup-codes/regenerate', { password: twofaPw })
      setTwofaPw('')
      setNewBackup(res.data.backup_codes)
      loadTwofa()
    } catch (e) {
      setTwofaMsg({ kind: 'error', text: errText(e, t('prof.2fa.backupErr')) })
    }
  }

  if (!me) return <p className="text-text-secondary">{t('prof.loading')}</p>

  return (
    <PageScaffold title={t('nav.profile')} guidanceKey="profile">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <div className="flex max-w-2xl flex-col gap-8">
        <form onSubmit={saveName} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-text-secondary">{t('prof.role')}</span>
            <Badge tone={me.role === 'admin' ? 'accent' : 'neutral'}>
              {me.role === 'admin' ? t('prof.roleAdmin') : t('prof.roleUser')}
            </Badge>
          </div>
          <label className={labelClass}>
            {t('common.email')}
            <input value={me.email} disabled className={`${fieldClass} font-mono opacity-70`} />
          </label>
          <label className={labelClass}>
            {t('common.name')}
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass} />
          </label>
          <div>
            <button type="submit" className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
              {t('common.save')}
            </button>
          </div>
        </form>

        <form onSubmit={changePassword} className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">{t('prof.pw.title')}</h2>
          <label className={labelClass}>
            {t('prof.pw.current')}
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={fieldClass} />
          </label>
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              {t('prof.pw.new')}
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required className={fieldClass} />
            </label>
            <label className={`${labelClass} flex-1`}>
              {t('prof.pw.repeat')}
              <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} required className={fieldClass} />
            </label>
          </div>
          <PasswordStrengthMeter password={newPw} />
          <div>
            <button type="submit" className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
              {t('prof.pw.title')}
            </button>
          </div>
        </form>

        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck size={18} /> {t('prof.2fa.title')}
          </h2>

          {twofaMsg && (
            <p className={`text-sm ${twofaMsg.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
              {twofaMsg.text}
            </p>
          )}

          {twofa && !twofa.enabled && !showSetup && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-secondary">
                {t('prof.2fa.protect')}
                {twofa.required && <span className="text-status-warning"> {t('prof.2fa.required')}</span>}
              </p>
              <div>
                <button onClick={() => setShowSetup(true)} className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white">
                  {t('prof.2fa.enable')}
                </button>
              </div>
            </div>
          )}

          {showSetup && (
            <TwoFASetup
              onCancel={() => setShowSetup(false)}
              onDone={() => {
                setShowSetup(false)
                loadTwofa()
                setTwofaMsg({ kind: 'info', text: t('prof.2fa.active') })
              }}
            />
          )}

          {twofa && twofa.enabled && !showSetup && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="success">{t('common.active')}</Badge>
                <span className="text-text-secondary">
                  {t('prof.2fa.method')}: {twofa.method === 'totp' ? t('prof.2fa.methodTotp') : t('prof.2fa.methodEmail')} ·{' '}
                  {t('prof.2fa.backupRemaining')}: <span className="font-mono text-text-primary">{twofa.backup_codes_remaining}</span>
                </span>
              </div>

              {newBackup && (
                <div>
                  <p className="mb-2 text-sm text-text-secondary">{t('prof.2fa.newBackup')}</p>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-bg p-3 font-mono text-sm sm:grid-cols-4">
                    {newBackup.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
                <label className={labelClass}>
                  {t('prof.2fa.confirmPw')}
                  <input type="password" value={twofaPw} onChange={(e) => setTwofaPw(e.target.value)} className={`${fieldClass} max-w-xs`} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={regenerateBackup}
                    disabled={!twofaPw}
                    className="rounded-md border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg disabled:opacity-60"
                  >
                    {t('prof.2fa.regenBackup')}
                  </button>
                  <button
                    onClick={disableTwofa}
                    disabled={!twofaPw || twofa.required}
                    title={twofa.required ? t('prof.2fa.requiredShort') : undefined}
                    className="rounded-md border border-status-danger/40 px-4 py-2 text-sm text-status-danger hover:bg-status-danger/10 disabled:opacity-60"
                  >
                    {t('prof.2fa.disable')}
                  </button>
                </div>
                {twofa.required && <p className="text-xs text-text-secondary">{t('prof.2fa.requiredNote')}</p>}
              </div>
            </div>
          )}
        </section>
      </div>
    </PageScaffold>
  )
}
