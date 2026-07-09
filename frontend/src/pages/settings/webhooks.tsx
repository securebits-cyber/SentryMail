/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Plus, Settings, Trash2, Webhook } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

interface WebhookItem {
  id: string
  url: string
  enabled: boolean
}

export default function WebhooksSettingsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [items, setItems] = useState<WebhookItem[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    api.get<WebhookItem[]>('/webhooks').then((r) => setItems(r.data))
  }

  useEffect(() => {
    if (licensed) load()
  }, [licensed])

  async function add(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/webhooks', { url })
      setUrl('')
      load()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await api.delete(`/webhooks/${id}`)
    load()
  }

  const breadcrumb = [
    { label: t('nav.settings'), icon: Settings },
    { label: t('settings.webhooks'), icon: Webhook },
  ]

  if (features === null) return <p className="text-text-secondary">{t('common.loadingSettings')}</p>

  if (!licensed)
    return (
      <PageScaffold title={t('wh.title')} subtitle={t('wh.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-webhooks">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )

  return (
    <PageScaffold title={t('wh.title')} subtitle={t('wh.subtitle')} breadcrumb={breadcrumb} guidanceKey="settings-webhooks">
      <p className="mb-4 max-w-2xl text-sm text-text-secondary">{t('wh.intro')}</p>
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      <Card className="max-w-2xl">
      <form onSubmit={add} className="mb-6 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://example.com/webhook"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-text-primary"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          <Plus size={15} />
          {t('wh.add')}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-text-secondary">{t('wh.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-md border border-border bg-sunken px-3 py-2">
              <Webhook size={15} className="shrink-0 text-text-secondary" />
              <span className="flex-1 truncate font-mono text-sm">{item.url}</span>
              <button
                onClick={() => remove(item.id)}
                className="shrink-0 text-text-secondary hover:text-status-danger"
                aria-label={t('common.delete')}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      </Card>
    </PageScaffold>
  )
}
