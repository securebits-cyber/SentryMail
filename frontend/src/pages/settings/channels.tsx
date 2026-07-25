/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, Plus, Send, Settings, Smartphone, Trash2 } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import Toggle from '../../components/Toggle'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { ChannelAddress, ChannelGateway, DeliverableChannel } from '../../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

const CHANNELS: DeliverableChannel[] = ['sms', 'matrix', 'talk']

export default function ChannelSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [channel, setChannel] = useState<DeliverableChannel>('sms')
  const [form, setForm] = useState<ChannelGateway | null>(null)
  const [secret, setSecret] = useState('')
  const [testAddress, setTestAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const [addresses, setAddresses] = useState<ChannelAddress[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newCompany, setNewCompany] = useState(true)

  const loadAddresses = useCallback(() => {
    api
      .get<ChannelAddress[]>('/channels/addresses', { params: { channel } })
      .then((res) => setAddresses(res.data))
      .catch(() => setAddresses([]))
  }, [channel])

  useEffect(() => {
    if (!licensed) return
    setForm(null)
    setSecret('')
    api.get<ChannelGateway>(`/settings/channels/${channel}`).then((res) => setForm(res.data))
    loadAddresses()
  }, [licensed, channel, loadAddresses])

  function set<K extends keyof ChannelGateway>(key: K, value: ChannelGateway[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.put<ChannelGateway>(`/settings/channels/${channel}`, {
        ...form,
        secret: secret || undefined,
      })
      setSecret('')
      setForm(res.data)
      setMessage({ kind: 'info', text: t('form.saved') })
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    if (!form || !testAddress.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      await api.put(`/settings/channels/${channel}`, { ...form, secret: secret || undefined })
      const res = await api.post<{ sent: number; details: { detail?: string }[] }>(
        `/settings/channels/${channel}/test`,
        { address: testAddress.trim(), text: t('ch.testText') },
      )
      setMessage(
        res.data.sent === 1
          ? { kind: 'info', text: t('ch.testOk') }
          : { kind: 'error', text: res.data.details[0]?.detail ?? t('form.err.test') },
      )
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setMessage({ kind: 'error', text: typeof detail === 'string' ? detail : t('form.err.test') })
    } finally {
      setBusy(false)
    }
  }

  async function addAddress(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api.put('/channels/addresses', {
        email: newEmail.trim(),
        channel,
        address: newAddress.trim(),
        is_company_device: newCompany,
      })
      setNewEmail('')
      setNewAddress('')
      setNewCompany(true)
      loadAddresses()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setMessage({ kind: 'error', text: typeof detail === 'string' ? detail : t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function removeAddress(id: string) {
    await api.delete(`/channels/addresses/${id}`)
    loadAddresses()
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.channels'), icon: Smartphone },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold
        title={t('ch.title')}
        subtitle={t('ch.subtitle')}
        breadcrumb={breadcrumb}
        guidanceKey="settings-channels"
      >
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )

  return (
    <PageScaffold
      title={t('ch.title')}
      subtitle={t('ch.subtitle')}
      breadcrumb={breadcrumb}
      guidanceKey="settings-channels"
    >
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {CHANNELS.map((item) => (
          <button
            key={item}
            onClick={() => setChannel(item)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              item === channel ? 'border-accent text-accent-text' : 'border-border hover:bg-bg'
            }`}
          >
            {t(`ch.name.${item}`)}
          </button>
        ))}
      </div>

      {!form ? (
        <p className="text-text-secondary">{t('common.loadingSettings')}</p>
      ) : (
        <Card className="max-w-2xl">
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
              <div>
                <div className="text-sm font-medium">{t('ch.enable')}</div>
                <div className="text-sm text-text-secondary">{t(`ch.enableDesc.${channel}`)}</div>
              </div>
              <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} aria-label={t('ch.enable')} />
            </div>

            <label className={labelClass}>
              {t('ch.label')}
              <input value={form.label} onChange={(e) => set('label', e.target.value)} className={fieldClass} />
              <span className="text-sm text-text-secondary">{t('ch.labelHint')}</span>
            </label>

            <label className={labelClass}>
              {t(`ch.url.${channel}`)}
              <input
                value={form.url}
                onChange={(e) => set('url', e.target.value)}
                placeholder={t(`ch.urlPlaceholder.${channel}`)}
                className={`${fieldClass} font-mono`}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <label className={labelClass}>
                {t('ch.authMode')}
                <select
                  value={form.auth_mode}
                  onChange={(e) => set('auth_mode', e.target.value as ChannelGateway['auth_mode'])}
                  className={fieldClass}
                >
                  <option value="none">{t('ch.auth.none')}</option>
                  <option value="basic">{t('ch.auth.basic')}</option>
                  <option value="bearer">{t('ch.auth.bearer')}</option>
                  <option value="header">{t('ch.auth.header')}</option>
                </select>
              </label>
              {form.auth_mode === 'basic' && (
                <label className={labelClass}>
                  {t('ch.username')}
                  <input
                    value={form.username}
                    onChange={(e) => set('username', e.target.value)}
                    className={`${fieldClass} font-mono`}
                  />
                </label>
              )}
              {form.auth_mode === 'header' && (
                <label className={labelClass}>
                  {t('ch.authHeader')}
                  <input
                    value={form.auth_header}
                    onChange={(e) => set('auth_header', e.target.value)}
                    placeholder="X-Api-Key"
                    className={`${fieldClass} font-mono`}
                  />
                </label>
              )}
            </div>

            {form.auth_mode !== 'none' && (
              <label className={labelClass}>
                {t('ch.secret')}
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={form.has_secret ? t('ch.secretSet') : ''}
                  className={`${fieldClass} font-mono`}
                />
              </label>
            )}

            {channel === 'sms' && (
              <>
                <div className="flex flex-wrap gap-3">
                  <label className={labelClass}>
                    {t('ch.method')}
                    <select
                      value={form.method}
                      onChange={(e) => set('method', e.target.value as ChannelGateway['method'])}
                      className={fieldClass}
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t('ch.bodyFormat')}
                    <select
                      value={form.body_format}
                      onChange={(e) => set('body_format', e.target.value as ChannelGateway['body_format'])}
                      className={fieldClass}
                    >
                      <option value="json">JSON</option>
                      <option value="form">{t('ch.body.form')}</option>
                    </select>
                  </label>
                </div>

                <label className={labelClass}>
                  {t('ch.bodyTemplate')}
                  <textarea
                    rows={4}
                    value={form.body_template}
                    onChange={(e) => set('body_template', e.target.value)}
                    placeholder={
                      form.body_format === 'json'
                        ? '{"to": "{to}", "message": "{text}"}'
                        : 'to={to}\nbody={text}'
                    }
                    className={`${fieldClass} font-mono`}
                  />
                  <span className="text-sm text-text-secondary">{t('ch.bodyTemplateHint')}</span>
                </label>
              </>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.verify_ssl}
                  onChange={(e) => set('verify_ssl', e.target.checked)}
                  className="accent-accent"
                />
                {t('ch.verifySsl')}
              </label>
              <label className={labelClass}>
                {t('ch.timeout')}
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={form.timeout_seconds}
                  onChange={(e) => set('timeout_seconds', Number(e.target.value))}
                  className={`${fieldClass} w-24 font-mono`}
                />
              </label>
            </div>

            <div className="rounded-lg border border-status-warning/30 bg-status-warning/8 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allow_private_devices}
                  onChange={(e) => set('allow_private_devices', e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  <span className="font-medium">{t('ch.allowPrivate')}</span>
                  <span className="mt-1 block text-text-secondary">{t('ch.allowPrivateHint')}</span>
                </span>
              </label>
            </div>

            {form.last_error && (
              <p className="flex items-start gap-2 text-sm text-status-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {form.last_error}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {t('common.save')}
              </button>
              <label className={labelClass}>
                {t('ch.testAddress')}
                <div className="flex gap-2">
                  <input
                    value={testAddress}
                    onChange={(e) => setTestAddress(e.target.value)}
                    placeholder={t(`ch.addressPlaceholder.${channel}`)}
                    className={`${fieldClass} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={test}
                    disabled={busy || !testAddress.trim()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-60"
                  >
                    <Send size={14} />
                    {t('ch.test')}
                  </button>
                </div>
                <span className="text-sm text-text-secondary">{t('ch.testHint')}</span>
              </label>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-6 max-w-3xl" title={t('ch.directory')} subtitle={t('ch.directoryHint')}>
        <form onSubmit={addAddress} className="mb-4 flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            {t('ch.dir.email')}
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={`${fieldClass} font-mono`}
            />
          </label>
          <label className={labelClass}>
            {t(`ch.dir.address.${channel}`)}
            <input
              required
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder={t(`ch.addressPlaceholder.${channel}`)}
              className={`${fieldClass} font-mono`}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={newCompany}
              onChange={(e) => setNewCompany(e.target.checked)}
              className="accent-accent"
            />
            {t('ch.dir.company')}
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <Plus size={14} />
            {t('common.add')}
          </button>
        </form>

        {addresses.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('ch.dir.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="py-2 pr-4 font-medium">{t('ch.dir.email')}</th>
                  <th className="py-2 pr-4 font-medium">{t(`ch.dir.address.${channel}`)}</th>
                  <th className="py-2 pr-4 font-medium">{t('ch.dir.device')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {addresses.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="py-2 pr-4 font-mono text-xs">{row.email}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{row.address}</td>
                    <td className="py-2 pr-4">
                      {row.is_company_device ? (
                        <span className="text-text-secondary">{t('ch.dir.company')}</span>
                      ) : (
                        <span className="text-status-warning">{t('ch.dir.private')}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => void removeAddress(row.id)}
                        className="text-text-secondary hover:text-status-danger"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageScaffold>
  )
}
