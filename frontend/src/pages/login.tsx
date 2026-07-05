import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TwoFASetup from '../components/TwoFASetup'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useI18n } from '../i18n'
import { getAuthConfig, loginLocal, loginUrl, loginVerify2fa, setToken } from '../services/auth'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const primaryBtn = 'rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60'

export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [oidcEnabled, setOidcEnabled] = useState(false)

  // 2FA-Zwischenschritt
  const [stage, setStage] = useState<'password' | 'verify' | 'setup'>('password')
  const [preAuth, setPreAuth] = useState('')
  const [method, setMethod] = useState<string | null>(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    getAuthConfig().then((config) => setOidcEnabled(config.oidc_enabled))
  }, [])

  async function handlePassword(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await loginLocal(email, password)
      if (res.access_token) {
        navigate('/', { replace: true })
        return
      }
      if (res.twofa_required && res.pre_auth_token) {
        setPreAuth(res.pre_auth_token)
        setMethod(res.method)
        if (res.setup_required) {
          // Erzwungene Einrichtung: Pre-Auth-Token nutzen, bis das Voll-Token kommt.
          setToken(res.pre_auth_token)
          setStage('setup')
        } else {
          setStage('verify')
        }
      }
    } catch {
      setError(t('login.errorCredentials'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await loginVerify2fa(preAuth, code)
      navigate('/', { replace: true })
    } catch {
      setError(t('login.2fa.errorCode'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-6 text-text-primary">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-semibold">HumanShield.APP</h1>

      {stage === 'password' && (
        <>
          <form onSubmit={handlePassword} className="flex w-72 flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t('login.email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('login.password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
            </label>
            {error && <p className="m-0 text-sm text-status-danger">{error}</p>}
            <button type="submit" disabled={submitting} className={primaryBtn}>
              {submitting ? t('login.checking') : t('login.signIn')}
            </button>
          </form>

          {oidcEnabled && (
            <a href={loginUrl()} className="text-sm text-text-secondary underline">
              {t('login.sso')}
            </a>
          )}
        </>
      )}

      {stage === 'verify' && (
        <form onSubmit={handleVerify} className="flex w-80 flex-col gap-3">
          <p className="text-sm text-text-secondary">
            {method === 'email' ? t('login.2fa.emailSent') : t('login.2fa.appPrompt')} {t('login.2fa.backupHint')}
          </p>
          <label className="flex flex-col gap-1 text-sm">
            {t('login.2fa.codeLabel')}
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus placeholder="123456" className={`${fieldClass} font-mono`} />
          </label>
          {error && <p className="m-0 text-sm text-status-danger">{error}</p>}
          <button type="submit" disabled={submitting || !code} className={primaryBtn}>
            {submitting ? t('login.2fa.checking') : t('login.2fa.confirm')}
          </button>
          <button type="button" onClick={() => setStage('password')} className="text-sm text-text-secondary hover:underline">
            {t('common.back')}
          </button>
        </form>
      )}

      {stage === 'setup' && (
        <div className="w-full max-w-xl">
          <p className="mb-3 text-center text-sm text-status-warning">{t('login.2fa.setupRequired')}</p>
          <TwoFASetup
            onCancel={() => setStage('password')}
            onDone={(activated) => {
              if (activated.access_token) {
                setToken(activated.access_token)
                navigate('/', { replace: true })
              } else {
                setStage('verify')
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
