/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FileText, Settings, X } from 'lucide-react'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface PdfBranding {
  logo_b64: string | null
}

// Client-seitiges Limit (das Add-on validiert zusätzlich): großzügig, damit ein
// hochauflösendes Logo möglich ist, aber keine Riesen-Datei in die DB wandert.
const MAX_LOGO_BYTES = 512 * 1024

export default function PdfReportSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [form, setForm] = useState<PdfBranding | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<PdfBranding>('/settings/pdf-branding').then((res) => setForm({ logo_b64: res.data.logo_b64 }))
  }, [licensed])

  function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      setMessage(t('pdfReport.tooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm({ logo_b64: String(reader.result) })
    reader.readAsDataURL(file)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      // Der Server validiert/normalisiert (Typprüfung + Skalierung) und gibt das
      // bereinigte Logo zurück – Vorschau darauf aktualisieren.
      const res = await api.put<PdfBranding>('/settings/pdf-branding', form)
      setForm({ logo_b64: res.data.logo_b64 })
      setMessage(t('pdfReport.saved'))
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage(detail || t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.pdfReport'), icon: FileText },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('pdfReport.title')} subtitle={t('pdfReport.subtitle')} breadcrumb={breadcrumb}>
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('pdfReport.title')} subtitle={t('pdfReport.subtitle')} breadcrumb={breadcrumb}>
      {message && <p className="mb-4 text-sm text-text-secondary">{message}</p>}

      <Card className="max-w-xl">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm">
            {t('pdfReport.logo')}
            <div className="flex items-center gap-3">
              {form.logo_b64 ? (
                <>
                  <img src={form.logo_b64} alt="" className="h-10 max-w-[180px] rounded border border-border object-contain" />
                  <button
                    type="button"
                    onClick={() => setForm({ logo_b64: null })}
                    className="text-text-secondary hover:text-status-danger"
                    aria-label={t('common.delete')}
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg">
                  {t('pdfReport.logoUpload')}
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onLogo} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-xs text-text-secondary">{t('pdfReport.hint')}</p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Card>
    </PageScaffold>
  )
}
