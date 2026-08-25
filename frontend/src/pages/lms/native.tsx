/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle, CheckCircle2, Package, Upload, XCircle } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import AddonNotice from '../../components/AddonNotice'
import BetaBadge from '../../components/BetaBadge'
import Card from '../../components/Card'
import PageScaffold from '../../components/PageScaffold'
import { useAddonState } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

/**
 * Verwaltung der nativen Lernmodule.
 *
 * Eigener Zweig unter `/lms/native`: Solange der Schalter der Installation aus
 * ist, antwortet das Backend dort mit 404. Diese Seite zeigt dann den Schalter
 * statt einer Fehlermeldung — einschalten lässt er sich über die
 * LMS-Einstellungen, die unabhängig vom Schalter erreichbar bleiben.
 */

interface ImportResult {
  content_key: string
  locale: string
  version: number
  status: 'imported' | 'skipped' | 'failed'
  message: string
  imported_at?: string | null
}

interface CatalogEntry {
  course_id: string
  content_key: string
  catalog_group: string | null
  locale: string
  version: number
  title: string
  level_count: number
  is_managed: boolean
}

interface TenantConfig {
  org_name: string
  logo_url: string
  report_channel_type: string | null
  report_label: string
  report_detail: string
  report_fallback: string
  contact_hint: string
  missing: string[]
}

const CHANNELS = ['outlook_button', 'mailto', 'ticket', 'telefon'] as const

export default function LmsNativePage() {
  const { t } = useI18n()
  const addon = useAddonState('enterprise')
  const licensed = addon === 'ready'

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [journal, setJournal] = useState<ImportResult[]>([])
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lastImport, setLastImport] = useState<ImportResult[] | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const settings = await api.get<{ native_modules_enabled: boolean }>('/lms/settings')
    setEnabled(settings.data.native_modules_enabled)
    if (!settings.data.native_modules_enabled) return

    const [cat, jour, cfg] = await Promise.all([
      api.get<CatalogEntry[]>('/lms/native/catalog'),
      api.get<ImportResult[]>('/lms/native/content/imports'),
      api.get<TenantConfig>('/lms/native/tenant-config'),
    ])
    setCatalog(cat.data)
    setJournal(jour.data)
    setConfig(cfg.data)
  }, [])

  useEffect(() => {
    if (licensed) void load()
  }, [licensed, load])

  async function enable() {
    await api.patch('/lms/settings', { native_modules_enabled: true })
    await load()
  }

  async function upload(event: FormEvent) {
    event.preventDefault()
    const datei = fileRef.current?.files?.[0]
    if (!datei) return
    setUploading(true)
    setLastImport(null)
    try {
      const form = new FormData()
      form.append('datei', datei)
      const res = await api.post<ImportResult[]>('/lms/native/content/import', form)
      setLastImport(res.data)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function saveConfig(event: FormEvent) {
    event.preventDefault()
    if (!config) return
    const res = await api.put<TenantConfig>('/lms/native/tenant-config', {
      org_name: config.org_name,
      logo_url: config.logo_url,
      report_channel_type: config.report_channel_type || null,
      report_label: config.report_label,
      report_detail: config.report_detail,
      report_fallback: config.report_fallback,
      contact_hint: config.contact_hint,
    })
    setConfig(res.data)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }

  if (!licensed) {
    return (
      <PageScaffold title={t('lmsNative.title')} actions={<BetaBadge />}>
        <AddonNotice tier="enterprise" state={addon === 'missing' ? 'missing' : 'locked'} />
      </PageScaffold>
    )
  }

  if (enabled === false) {
    return (
      <PageScaffold title={t('lmsNative.title')} actions={<BetaBadge />}>
        <Card>
          <p>{t('lmsNative.disabled')}</p>
          <button type="button" className="btn btn--primary mt-3" onClick={() => void enable()}>
            {t('lmsNative.enable')}
          </button>
        </Card>
      </PageScaffold>
    )
  }

  return (
    <PageScaffold
      title={t('lmsNative.title')}
      subtitle={t('lmsNative.subtitle')}
      actions={<BetaBadge />}
    >
      <Card title={t('lmsNative.import')}>
        <form onSubmit={upload} className="flex flex-col gap-3">
          <input ref={fileRef} type="file" accept=".tar,.tar.zst,application/x-tar" required />
          <p className="text-sm text-text-secondary">{t('lmsNative.importHint')}</p>
          <button type="submit" className="btn btn--primary" disabled={uploading}>
            <Upload size={16} />
            {uploading ? t('lmsNative.importing') : t('lmsNative.import')}
          </button>
        </form>

        {lastImport && (
          <ul className="mt-4 flex flex-col gap-1.5" role="list">
            {lastImport.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.status === 'imported' ? (
                  <CheckCircle2 size={16} className="text-status-success shrink-0" />
                ) : r.status === 'skipped' ? (
                  <AlertTriangle size={16} className="text-status-warning shrink-0" />
                ) : (
                  <XCircle size={16} className="text-status-danger shrink-0" />
                )}
                <span>
                  {r.content_key || '—'} {r.locale} v{r.version}: {r.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('lmsNative.catalog')}>
        {catalog.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('lmsNative.noCatalog')}</p>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {catalog.map((e) => (
              <li key={e.course_id} className="flex items-center gap-2 text-sm">
                <Package size={16} className="text-text-muted shrink-0" />
                <span className="font-medium">{e.title}</span>
                <span className="text-text-secondary">
                  {e.content_key} · {e.locale} · v{e.version} · {e.level_count}{' '}
                  {t('lmsNative.levels')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {config && (
        <Card title={t('lmsNative.tenant')} subtitle={t('lmsNative.tenantHint')}>
          {config.missing.length > 0 && (
            <p className="mb-3 flex items-start gap-2 text-sm text-status-warning">
              <AlertTriangle size={16} className="shrink-0" />
              {t('lmsNative.missing')} {config.missing.join(', ')}
            </p>
          )}
          <form onSubmit={saveConfig} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t('lmsNative.orgName')}
              <input
                value={config.org_name}
                onChange={(e) => setConfig({ ...config, org_name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('lmsNative.channelType')}
              <select
                value={config.report_channel_type ?? ''}
                onChange={(e) =>
                  setConfig({ ...config, report_channel_type: e.target.value || null })
                }
              >
                <option value="">—</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('lmsNative.channelLabel')}
              <input
                value={config.report_label}
                onChange={(e) => setConfig({ ...config, report_label: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('lmsNative.channelDetail')}
              <input
                value={config.report_detail}
                onChange={(e) => setConfig({ ...config, report_detail: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('lmsNative.channelFallback')}
              <input
                value={config.report_fallback}
                onChange={(e) => setConfig({ ...config, report_fallback: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('lmsNative.contactHint')}
              <input
                value={config.contact_hint}
                onChange={(e) => setConfig({ ...config, contact_hint: e.target.value })}
              />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn--primary">
                {t('lmsNative.save')}
              </button>
              {saved && <span className="text-sm text-status-success">{t('lmsNative.saved')}</span>}
            </div>
          </form>
        </Card>
      )}

      <Card title={t('lmsNative.journal')}>
        {journal.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('lmsNative.noCatalog')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" role="list">
            {journal.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.status === 'imported' ? (
                  <CheckCircle2 size={16} className="text-status-success shrink-0" />
                ) : r.status === 'skipped' ? (
                  <AlertTriangle size={16} className="text-status-warning shrink-0" />
                ) : (
                  <XCircle size={16} className="text-status-danger shrink-0" />
                )}
                <span>
                  {r.imported_at ? new Date(r.imported_at).toLocaleString() : ''}{' '}
                  {r.content_key || '—'} {r.locale} v{r.version}: {r.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageScaffold>
  )
}
