/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FileText, Settings } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import LogoUploadField from '../../components/LogoUploadField'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface PdfBranding {
  logo_b64: string | null
  logo_b64_dark: string | null
}

export default function PdfReportSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [form, setForm] = useState<PdfBranding | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<PdfBranding>('/settings/pdf-branding').then((res) =>
      setForm({ logo_b64: res.data.logo_b64, logo_b64_dark: res.data.logo_b64_dark }),
    )
  }, [licensed])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      // Der Server validiert/normalisiert (Typprüfung + Skalierung) und gibt die
      // bereinigten Logos zurück – Vorschau darauf aktualisieren.
      const res = await api.put<PdfBranding>('/settings/pdf-branding', form)
      setForm({ logo_b64: res.data.logo_b64, logo_b64_dark: res.data.logo_b64_dark })
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
          <LogoUploadField
            label={t('pdfReport.logoLight')}
            value={form.logo_b64}
            onChange={(v) => setForm({ ...form, logo_b64: v })}
            uploadLabel={t('pdfReport.logoUpload')}
            onTooLarge={() => setMessage(t('pdfReport.tooLarge'))}
          />
          <LogoUploadField
            label={t('pdfReport.logoDark')}
            value={form.logo_b64_dark}
            onChange={(v) => setForm({ ...form, logo_b64_dark: v })}
            uploadLabel={t('pdfReport.logoUpload')}
            onTooLarge={() => setMessage(t('pdfReport.tooLarge'))}
            darkPreview
          />
          <p className="text-xs text-text-secondary">{t('pdfReport.hint')}</p>

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
