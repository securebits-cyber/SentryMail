/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Download, Send, Smartphone, Usb } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Badge from '../components/Badge'
import Card from '../components/Card'
import LockedFeatureNotice from '../components/LockedFeatureNotice'
import PageScaffold from '../components/PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import type { CampaignChannel, ChannelKind, ChannelSendResult, UsbDrop } from '../types'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

const CHANNELS: ChannelKind[] = ['sms', 'matrix', 'talk', 'usb']

interface CampaignOption {
  id: string
  name: string
  status: string
}

export default function ChannelCampaignsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [channel, setChannel] = useState<ChannelKind>('sms')
  const [messageText, setMessageText] = useState('')
  const [drops, setDrops] = useState<UsbDrop[]>([])
  const [labels, setLabels] = useState('')
  const [filename, setFilename] = useState('Gehaltsuebersicht_2026.html')
  const [result, setResult] = useState<ChannelSendResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (!licensed) return
    api
      .get<CampaignOption[]>('/campaigns')
      .then((res) => setCampaigns(res.data))
      .catch(() => setCampaigns([]))
  }, [licensed])

  const loadDrops = useCallback(
    (id: string) => {
      api
        .get<UsbDrop[]>(`/channels/campaigns/${id}/usb-drops`)
        .then((res) => setDrops(res.data))
        .catch(() => setDrops([]))
    },
    [],
  )

  useEffect(() => {
    if (!campaignId) return
    setResult(null)
    api
      .get<CampaignChannel>(`/channels/campaigns/${campaignId}`)
      .then((res) => {
        setChannel(res.data.channel)
        setMessageText(res.data.message_text)
      })
      .catch(() => {
        // Noch kein Kanal gesetzt — das ist der Normalfall bei einer neuen
        // Kampagne, keine Fehlermeldung wert.
        setChannel('sms')
        setMessageText('')
      })
    loadDrops(campaignId)
  }, [campaignId, loadDrops])

  async function saveChannel() {
    setBusy(true)
    setMessage(null)
    try {
      await api.put(`/channels/campaigns/${campaignId}`, { channel, message_text: messageText })
      setMessage({ kind: 'info', text: t('form.saved') })
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setMessage({ kind: 'error', text: typeof detail === 'string' ? detail : t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!window.confirm(t('cc.confirmSend'))) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.post<ChannelSendResult>(`/channels/campaigns/${campaignId}/send`)
      setResult(res.data)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setMessage({ kind: 'error', text: typeof detail === 'string' ? detail : t('cc.err.send') })
    } finally {
      setBusy(false)
    }
  }

  async function createDrops() {
    const list = labels
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (list.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      await api.post(`/channels/campaigns/${campaignId}/usb-drops`, { labels: list })
      setLabels('')
      loadDrops(campaignId)
    } catch {
      setMessage({ kind: 'error', text: t('form.err.save') })
    } finally {
      setBusy(false)
    }
  }

  async function downloadPackage() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await api.get(`/channels/campaigns/${campaignId}/usb-package`, {
        params: { filename },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'usb-drop.zip'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setMessage({ kind: 'error', text: t('cc.err.package') })
    } finally {
      setBusy(false)
    }
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('cc.title')} subtitle={t('cc.subtitle')} guidanceKey="channel-campaigns">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )

  const isUsb = channel === 'usb'

  return (
    <PageScaffold title={t('cc.title')} subtitle={t('cc.subtitle')} guidanceKey="channel-campaigns">
      {message && (
        <p className={`mb-4 text-sm ${message.kind === 'error' ? 'text-status-danger' : 'text-text-secondary'}`}>
          {message.text}
        </p>
      )}

      <Card className="max-w-2xl">
        <div className="flex flex-col gap-4">
          <label className={labelClass}>
            {t('cc.campaign')}
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t('cc.choose')}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {campaignId && (
            <>
              <label className={labelClass}>
                {t('cc.channel')}
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ChannelKind)}
                  className={fieldClass}
                >
                  {CHANNELS.map((item) => (
                    <option key={item} value={item}>
                      {t(`ch.name.${item}`)}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-text-secondary">{t(`cc.channelHint.${channel}`)}</span>
              </label>

              {!isUsb && (
                <label className={labelClass}>
                  {t('cc.messageText')}
                  <textarea
                    rows={4}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t('cc.messagePlaceholder')}
                    className={fieldClass}
                  />
                  <span className="text-sm text-text-secondary">{t('cc.messageHint')}</span>
                </label>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={saveChannel}
                  disabled={busy}
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {t('common.save')}
                </button>
                {!isUsb && (
                  <button
                    onClick={send}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-60"
                  >
                    <Send size={14} />
                    {t('cc.send')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {result && (
        <Card className="mt-6 max-w-2xl" title={t('cc.result')}>
          <p className="mb-3 text-sm">
            {t('cc.resultLine', { sent: String(result.sent), skipped: String(result.skipped) })}
          </p>
          {result.details.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {result.details.map((detail, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2 border-b border-border py-1">
                  <span className="font-mono text-xs">{detail.email ?? '—'}</span>
                  <span className="text-text-secondary">{t(`cc.reason.${detail.reason}`)}</span>
                  {detail.detail && <span className="text-xs text-status-danger">{detail.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {campaignId && isUsb && (
        <Card
          className="mt-6 max-w-2xl"
          title={
            <span className="inline-flex items-center gap-2">
              <Usb size={16} />
              {t('cc.usb')}
            </span>
          }
          subtitle={t('cc.usbHint')}
        >
          <div className="flex flex-col gap-4">
            <label className={labelClass}>
              {t('cc.usbLabels')}
              <textarea
                rows={4}
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                placeholder={t('cc.usbLabelsPlaceholder')}
                className={fieldClass}
              />
            </label>
            <div>
              <button
                onClick={createDrops}
                disabled={busy || !labels.trim()}
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {t('cc.usbCreate')}
              </button>
            </div>

            {drops.length > 0 && (
              <>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-secondary">
                      <th className="py-2 pr-4 font-medium">{t('cc.usbLocation')}</th>
                      <th className="py-2 font-medium">{t('cc.usbOpened')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drops.map((drop) => (
                      <tr key={drop.tracking_token} className="border-b border-border">
                        <td className="py-2 pr-4">{drop.label || '—'}</td>
                        <td className="py-2">
                          {drop.opened ? (
                            <Badge tone="danger">{t('cc.usbYes')}</Badge>
                          ) : (
                            <span className="text-text-secondary">{t('cc.usbNo')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex flex-wrap items-end gap-3">
                  <label className={labelClass}>
                    {t('cc.usbFilename')}
                    <input
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className={`${fieldClass} font-mono`}
                    />
                  </label>
                  <button
                    onClick={downloadPackage}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-60"
                  >
                    <Download size={14} />
                    {t('cc.usbDownload')}
                  </button>
                </div>
                <p className="rounded-lg border border-border bg-bg p-3 text-sm text-text-secondary">
                  {t('cc.usbSafetyNote')}
                </p>
              </>
            )}
          </div>
        </Card>
      )}

      {!campaignId && (
        <p className="mt-6 flex items-center gap-2 text-sm text-text-secondary">
          <Smartphone size={14} />
          {t('cc.pickFirst')}
        </p>
      )}
    </PageScaffold>
  )
}
