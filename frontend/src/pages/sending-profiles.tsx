/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import PageScaffold from '../components/PageScaffold'
import SendingProfileForm, { SendingProfileFormValues } from '../components/SendingProfileForm'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { SendingProfile } from '../types'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; profile: SendingProfile }

export default function SendingProfilesPage() {
  const { t } = useI18n()
  const [profiles, setProfiles] = useState<SendingProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  function load() {
    setLoading(true)
    api
      .get<SendingProfile[]>('/sending-profiles')
      .then((res) => setProfiles(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleSubmit(values: SendingProfileFormValues) {
    setSubmitting(true)
    setMessage(null)
    try {
      if (mode.kind === 'edit') {
        await api.patch(`/sending-profiles/${mode.profile.id}`, values)
      } else {
        await api.post('/sending-profiles', values)
      }
      setMode({ kind: 'list' })
      load()
    } catch {
      setMessage({ kind: 'error', text: t('sp.err.save') })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(profile: SendingProfile) {
    if (!window.confirm(t('common.confirmDelete', { name: profile.name }))) return
    setMessage(null)
    try {
      await api.delete(`/sending-profiles/${profile.id}`)
      load()
    } catch {
      setMessage({ kind: 'error', text: t('sp.err.delete') })
    }
  }

  async function handleTest(profile: SendingProfile) {
    const email = window.prompt(t('sp.test.prompt', { name: profile.name }))
    if (!email) return
    setMessage({ kind: 'info', text: t('sp.test.sending') })
    try {
      const res = await api.post<{ success: boolean; detail: string }>(
        `/sending-profiles/${profile.id}/test`,
        { email },
      )
      setMessage({ kind: res.data.success ? 'info' : 'error', text: res.data.detail })
    } catch {
      setMessage({ kind: 'error', text: t('sp.test.err') })
    }
  }

  if (mode.kind !== 'list') {
    return (
      <PageScaffold title={mode.kind === 'edit' ? t('sp.editTitle') : t('sp.newTitle')}>
        {message && (
          <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
            {message.text}
          </p>
        )}
        <SendingProfileForm
          initial={mode.kind === 'edit' ? mode.profile : null}
          onSubmit={handleSubmit}
          onCancel={() => {
            setMode({ kind: 'list' })
            setMessage(null)
          }}
          submitting={submitting}
        />
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title={t('nav.sendingProfiles')}
      guidanceKey="sending-profiles"
      actions={
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          {t('sp.new')}
        </button>
      }
    >
      {message && (
        <p className={`mb-3 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-text-secondary">{t('sp.loading')}</p>
      ) : profiles.length === 0 ? (
        <p className="text-text-secondary">{t('sp.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('sp.col.host')}</th>
                <th className="py-2 pr-4 font-medium">{t('sp.col.sender')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-border">
                  <td className="py-2 pr-4">{profile.name}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">
                    {profile.host}:{profile.port}
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm text-text-secondary">{profile.from_email}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => handleTest(profile)} className="mr-3 text-text-secondary hover:text-accent hover:underline">
                      {t('sp.test')}
                    </button>
                    <button
                      onClick={() => setMode({ kind: 'edit', profile })}
                      className="mr-3 text-text-secondary hover:text-accent hover:underline"
                    >
                      {t('common.edit')}
                    </button>
                    <button onClick={() => handleDelete(profile)} className="text-status-danger hover:underline">
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
