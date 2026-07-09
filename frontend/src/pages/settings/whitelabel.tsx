/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Palette, Settings, X } from 'lucide-react'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useBranding } from '../../components/BrandingProvider'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface Whitelabel {
  app_name: string
  accent_color: string
  accent_color_2: string
  logo_b64: string | null
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function WhitelabelSettingsPage() {
  const { t } = useI18n()
  const { refresh } = useBranding()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [form, setForm] = useState<Whitelabel | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!licensed) return
    api.get<Whitelabel>('/settings/whitelabel').then((res) => setForm(res.data))
  }, [licensed])

  function set<K extends keyof Whitelabel>(key: K, value: Whitelabel[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('logo_b64', String(reader.result))
    reader.readAsDataURL(file)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setBusy(true)
    setMessage(null)
    try {
      await api.put('/settings/whitelabel', form)
      refresh() // Branding live aktualisieren (Header/Titel)
      setMessage(t('wl.saved'))
    } catch {
      setMessage(t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.whitelabel'), icon: Palette },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('wl.title')} subtitle={t('wl.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-whitelabel">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )
  if (!form) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  return (
    <PageScaffold title={t('wl.title')} subtitle={t('wl.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-whitelabel">
      {message && <p className="mb-4 text-sm text-text-secondary">{message}</p>}

      <Card className="max-w-xl">
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className={labelClass}>
          {t('wl.appName')}
          <input value={form.app_name} onChange={(e) => set('app_name', e.target.value)} className={fieldClass} />
        </label>

        <div className="flex gap-6">
          <label className={labelClass}>
            {t('wl.accent')}
            <input type="color" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} className="h-10 w-16 rounded-md border border-border" />
          </label>
          <label className={labelClass}>
            {t('wl.accent2')}
            <input type="color" value={form.accent_color_2} onChange={(e) => set('accent_color_2', e.target.value)} className="h-10 w-16 rounded-md border border-border" />
          </label>
        </div>

        <div className={labelClass}>
          {t('wl.logo')}
          <div className="flex items-center gap-3">
            {form.logo_b64 ? (
              <>
                <img src={form.logo_b64} alt="" className="h-10 max-w-[180px] rounded border border-border object-contain" />
                <button type="button" onClick={() => set('logo_b64', null)} className="text-text-secondary hover:text-status-danger" aria-label={t('common.delete')}>
                  <X size={16} />
                </button>
              </>
            ) : (
              <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg">
                {t('wl.logoUpload')}
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
              </label>
            )}
          </div>
        </div>

        <button type="submit" disabled={busy} className="w-fit rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60">
          {busy ? t('common.saving') : t('common.save')}
        </button>
        <p className="text-xs text-text-secondary">{t('wl.reloadNote')}</p>
      </form>
      </Card>
    </PageScaffold>
  )
}
