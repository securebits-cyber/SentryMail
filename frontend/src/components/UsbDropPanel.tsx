/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useCallback, useEffect, useState } from 'react'
import { Download, Usb } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../i18n'
import type { UsbDrop } from '../types'
import Badge from './Badge'
import Card from './Card'

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

/** Fundorte anlegen und das Paket herunterladen.
 *
 *  Als eigene Komponente, weil derselbe Schritt an zwei Stellen gebraucht wird:
 *  direkt nach dem Anlegen einer USB-Kampagne und später auf der Kanal-Seite.
 *  Zwei Abschriften wären zwei Stände, sobald sich etwas am Ablauf ändert. */
export default function UsbDropPanel({ campaignId }: { campaignId: string }) {
  const { t } = useI18n()
  const [drops, setDrops] = useState<UsbDrop[]>([])
  const [labels, setLabels] = useState('')
  const [filename, setFilename] = useState('Gehaltsuebersicht_2026.html')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDrops = useCallback(() => {
    api
      .get<UsbDrop[]>(`/channels/campaigns/${campaignId}/usb-drops`)
      .then((res) => setDrops(res.data))
      .catch(() => setDrops([]))
  }, [campaignId])

  useEffect(loadDrops, [loadDrops])

  async function createDrops() {
    const list = labels
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (list.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/channels/campaigns/${campaignId}/usb-drops`, { labels: list })
      setLabels('')
      loadDrops()
    } catch {
      setError(t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  async function downloadPackage() {
    setBusy(true)
    setError(null)
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
      setError(t('cc.err.package'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      className="max-w-2xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Usb size={16} />
          {t('cc.usb')}
        </span>
      }
      subtitle={t('cc.usbHint')}
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-status-danger">{error}</p>}

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
            type="button"
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
                type="button"
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
  )
}
