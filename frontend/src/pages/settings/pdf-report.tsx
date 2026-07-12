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
  company_name: string | null
  company_street: string | null
  company_zip: string | null
  company_city: string | null
  company_contact: string | null
  company_department: string | null
  company_phone: string | null
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

function toForm(data: PdfBranding): PdfBranding {
  return {
    logo_b64: data.logo_b64,
    logo_b64_dark: data.logo_b64_dark,
    company_name: data.company_name,
    company_street: data.company_street,
    company_zip: data.company_zip,
    company_city: data.company_city,
    company_contact: data.company_contact,
    company_department: data.company_department,
    company_phone: data.company_phone,
  }
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
    api.get<PdfBranding>('/settings/pdf-branding').then((res) => setForm(toForm(res.data)))
  }, [licensed])

  function setField(key: keyof PdfBranding, value: string | null) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      // Der Server validiert/normalisiert (Typprüfung + Skalierung der Logos,
      // Trimmen der Firmendaten) und gibt den bereinigten Stand zurück.
      const res = await api.put<PdfBranding>('/settings/pdf-branding', form)
      setForm(toForm(res.data))
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

      <form onSubmit={save} className="flex max-w-xl flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-4">
            <LogoUploadField
              label={t('pdfReport.logoLight')}
              value={form.logo_b64}
              onChange={(v) => setField('logo_b64', v)}
              uploadLabel={t('pdfReport.logoUpload')}
              onTooLarge={() => setMessage(t('pdfReport.tooLarge'))}
            />
            <LogoUploadField
              label={t('pdfReport.logoDark')}
              value={form.logo_b64_dark}
              onChange={(v) => setField('logo_b64_dark', v)}
              uploadLabel={t('pdfReport.logoUpload')}
              onTooLarge={() => setMessage(t('pdfReport.tooLarge'))}
              darkPreview
            />
            <p className="text-xs text-text-secondary">{t('pdfReport.hint')}</p>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-medium">{t('pdfReport.companyTitle')}</h2>
              <p className="text-xs text-text-secondary">{t('pdfReport.companyHint')}</p>
            </div>
            <label className={labelClass}>
              {t('pdfReport.companyName')}
              <input
                value={form.company_name ?? ''}
                onChange={(e) => setField('company_name', e.target.value)}
                maxLength={200}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              {t('pdfReport.companyStreet')}
              <input
                value={form.company_street ?? ''}
                onChange={(e) => setField('company_street', e.target.value)}
                maxLength={200}
                className={fieldClass}
              />
            </label>
            <div className="flex gap-4">
              <label className={`${labelClass} w-32`}>
                {t('pdfReport.companyZip')}
                <input
                  value={form.company_zip ?? ''}
                  onChange={(e) => setField('company_zip', e.target.value)}
                  maxLength={200}
                  className={fieldClass}
                />
              </label>
              <label className={`${labelClass} flex-1`}>
                {t('pdfReport.companyCity')}
                <input
                  value={form.company_city ?? ''}
                  onChange={(e) => setField('company_city', e.target.value)}
                  maxLength={200}
                  className={fieldClass}
                />
              </label>
            </div>
            <div className="flex gap-4">
              <label className={`${labelClass} flex-1`}>
                {t('pdfReport.companyContact')}
                <input
                  value={form.company_contact ?? ''}
                  onChange={(e) => setField('company_contact', e.target.value)}
                  maxLength={200}
                  className={fieldClass}
                />
              </label>
              <label className={`${labelClass} flex-1`}>
                {t('pdfReport.companyDepartment')}
                <input
                  value={form.company_department ?? ''}
                  onChange={(e) => setField('company_department', e.target.value)}
                  maxLength={200}
                  className={fieldClass}
                />
              </label>
            </div>
            <label className={labelClass}>
              {t('pdfReport.companyPhone')}
              <input
                value={form.company_phone ?? ''}
                onChange={(e) => setField('company_phone', e.target.value)}
                maxLength={200}
                className={fieldClass}
              />
            </label>
          </div>
        </Card>

        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {busy ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </PageScaffold>
  )
}
