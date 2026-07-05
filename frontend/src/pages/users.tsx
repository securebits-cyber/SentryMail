/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FormEvent, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import PageScaffold from '../components/PageScaffold'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { User } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

/** Fehlermeldung des Backends (detail) herausziehen, sonst Fallback. */
function errText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export default function UsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  // Formular fuer neuen Benutzer
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    api
      .get<User[]>('/users')
      .then((res) => setUsers(res.data))
      .catch(() => setMessage({ kind: 'error', text: t('usr.err.load') }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      await api.post('/users', { email, full_name: fullName, password, role })
      setEmail('')
      setFullName('')
      setPassword('')
      setRole('user')
      setCreating(false)
      load()
      setMessage({ kind: 'info', text: t('usr.created') })
    } catch {
      setMessage({ kind: 'error', text: t('usr.err.create') })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(user: User) {
    setMessage(null)
    try {
      await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
      load()
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, t('usr.err.status')) })
    }
  }

  async function handleDelete(user: User) {
    if (!window.confirm(t('usr.confirmDelete', { email: user.email }))) return
    setMessage(null)
    try {
      await api.delete(`/users/${user.id}`)
      load()
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, t('usr.err.delete')) })
    }
  }

  async function resetTwofa(user: User) {
    if (!window.confirm(t('usr.confirmReset2fa', { email: user.email }))) return
    setMessage(null)
    try {
      await api.post(`/users/${user.id}/2fa/reset`)
      load()
      setMessage({ kind: 'info', text: t('usr.2faReset') })
    } catch (e) {
      setMessage({ kind: 'error', text: errText(e, t('usr.err.reset2fa')) })
    }
  }

  return (
    <PageScaffold
      title={t('nav.users')}
      guidanceKey="users"
      actions={
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {creating ? t('usr.close') : t('usr.new')}
        </button>
      }
    >
      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="elevated mb-6 flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              {t('common.email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
            </label>
            <label className={`${labelClass} flex-1`}>
              {t('common.name')}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass} />
            </label>
          </div>
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              {t('usr.password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
            </label>
            <label className={`${labelClass} w-40`}>
              {t('usr.role')}
              <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')} className={fieldClass}>
                <option value="user">{t('prof.roleUser')}</option>
                <option value="admin">{t('prof.roleAdmin')}</option>
              </select>
            </label>
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? t('usr.creating') : t('usr.create')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-text-secondary">{t('usr.loading')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.email')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('usr.role')}</th>
                <th className="py-2 pr-4 font-medium">{t('common.status')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border">
                  <td className="py-2 pr-4 font-mono text-sm">{user.email}</td>
                  <td className="py-2 pr-4">{user.full_name}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={user.role === 'admin' ? 'accent' : 'neutral'}>
                      {user.role === 'admin' ? t('prof.roleAdmin') : t('prof.roleUser')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? t('common.active') : t('usr.inactive')}
                      </Badge>
                      {user.twofa_enabled && <Badge tone="accent">2FA</Badge>}
                    </div>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => toggleActive(user)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      {user.is_active ? t('usr.deactivate') : t('usr.activate')}
                    </button>
                    {user.twofa_enabled && (
                      <button onClick={() => resetTwofa(user)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                        {t('usr.reset2fa')}
                      </button>
                    )}
                    <button onClick={() => handleDelete(user)} className="text-status-danger hover:underline">
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageScaffold>
  )
}
