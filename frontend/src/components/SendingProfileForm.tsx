import { FormEvent, useEffect, useState } from 'react'
import Toggle from './Toggle'
import { useI18n } from '../i18n'
import type { SendingProfile } from '../types'

export type TlsMode = 'none' | 'starttls' | 'ssl'

export interface SendingProfileFormValues {
  name: string
  host: string
  port: number
  username: string
  password?: string
  from_email: string
  from_name: string
  tls_mode: TlsMode
  ignore_cert_errors: boolean
}

interface SendingProfileFormProps {
  initial?: SendingProfile | null
  onSubmit: (values: SendingProfileFormValues) => void
  onCancel: () => void
  submitting?: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function SendingProfileForm({ initial, onSubmit, onCancel, submitting }: SendingProfileFormProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(587)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')
  const [tlsMode, setTlsMode] = useState<TlsMode>('starttls')
  const [ignoreCertErrors, setIgnoreCertErrors] = useState(false)

  useEffect(() => {
    setName(initial?.name ?? '')
    setHost(initial?.host ?? '')
    setPort(initial?.port ?? 587)
    setUsername(initial?.username ?? '')
    setPassword('')
    setFromEmail(initial?.from_email ?? '')
    setFromName(initial?.from_name ?? '')
    setTlsMode(initial?.tls_mode ?? 'starttls')
    setIgnoreCertErrors(initial?.ignore_cert_errors ?? false)
  }, [initial])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const values: SendingProfileFormValues = {
      name,
      host,
      port,
      username,
      from_email: fromEmail,
      from_name: fromName,
      tls_mode: tlsMode,
      ignore_cert_errors: ignoreCertErrors,
    }
    // Passwort nur mitschicken, wenn etwas eingegeben wurde (leer = unveraendert lassen).
    if (password) values.password = password
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <div className="flex gap-4">
        <label className={`${labelClass} flex-1`}>
          {t('field.host')}
          <input value={host} onChange={(e) => setHost(e.target.value)} required placeholder="smtp.example.com" className={fieldClass} />
        </label>
        <label className={`${labelClass} w-28`}>
          {t('field.port')}
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            required
            className={`${fieldClass} font-mono`}
          />
        </label>
      </div>

      <div className="flex gap-4">
        <label className={`${labelClass} flex-1`}>
          {t('smtp.username')}
          <input value={username} onChange={(e) => setUsername(e.target.value)} className={fieldClass} />
        </label>
        <label className={`${labelClass} flex-1`}>
          {t('smtp.password')} {initial && <span className="text-text-secondary">{t('form.secretUnchanged')}</span>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={initial?.has_password ? '••••••••' : ''}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="flex gap-4">
        <label className={`${labelClass} flex-1`}>
          {t('smtp.fromName')}
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} required placeholder="IT Security" className={fieldClass} />
        </label>
        <label className={`${labelClass} flex-1`}>
          {t('smtp.fromEmail')}
          <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} required placeholder="noreply@example.com" className={fieldClass} />
        </label>
      </div>

      <label className={labelClass}>
        {t('spf.encryption')}
        <select value={tlsMode} onChange={(e) => setTlsMode(e.target.value as TlsMode)} className={fieldClass}>
          <option value="starttls">{t('smtp.tls.starttls')}</option>
          <option value="ssl">{t('spf.tls.ssl')}</option>
          <option value="none">{t('spf.tls.none')}</option>
        </select>
        <span className="text-xs text-text-secondary">{t('spf.tlsHint')}</span>
      </label>
      <div className="flex items-center gap-3 text-sm">
        <Toggle checked={ignoreCertErrors} onChange={setIgnoreCertErrors} aria-label={t('spf.ignoreCert')} />
        {t('spf.ignoreCert')}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? t('common.saving') : initial ? t('form.saveChanges') : t('spf.create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
