/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Plus, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import Card from '../components/Card'
import LockedFeatureNotice from '../components/LockedFeatureNotice'
import PageScaffold from '../components/PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'

interface Opt {
  id: string
  name: string
}

interface Recurring {
  id: string
  name: string
  interval_days: number
  next_run_at: string
  enabled: boolean
  group_ids: string[]
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'

export default function RecurringPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [items, setItems] = useState<Recurring[]>([])
  const [templates, setTemplates] = useState<Opt[]>([])
  const [groups, setGroups] = useState<Opt[]>([])
  const [profiles, setProfiles] = useState<Opt[]>([])
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [profileId, setProfileId] = useState('')
  const [interval, setIntervalDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    api.get<Recurring[]>('/recurring').then((r) => setItems(r.data))
  }

  useEffect(() => {
    if (!licensed) return
    load()
    api.get<Opt[]>('/templates').then((r) => setTemplates(r.data))
    api.get<Opt[]>('/groups').then((r) => setGroups(r.data))
    api.get<Opt[]>('/sending-profiles').then((r) => setProfiles(r.data))
  }, [licensed])

  async function add(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/recurring', {
        name,
        template_id: templateId,
        group_ids: groupIds,
        sending_profile_id: profileId || null,
        interval_days: interval,
      })
      setName('')
      setTemplateId('')
      setGroupIds([])
      setProfileId('')
      setIntervalDays(30)
      load()
    } catch {
      setError(t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await api.delete(`/recurring/${id}`)
    load()
  }

  function toggleGroup(id: string) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('rec.title')} subtitle={t('rec.subtitle')} guidanceKey="recurring">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )

  return (
    <PageScaffold title={t('rec.title')} subtitle={t('rec.subtitle')} guidanceKey="recurring">
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      <Card className="mb-8 max-w-2xl">
      <form onSubmit={add} className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('rec.name')} className={fieldClass} />

        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className={fieldClass}>
          <option value="">{t('rec.template')}…</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
          ))}
        </select>

        <div className="rounded-md border border-border p-3">
          <div className="mb-2 text-sm text-text-secondary">{t('rec.groups')}</div>
          <div className="flex flex-wrap gap-3">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                {g.name}
              </label>
            ))}
            {groups.length === 0 && <span className="text-sm text-text-secondary">—</span>}
          </div>
        </div>

        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={fieldClass}>
          <option value="">{t('rec.profileDefault')}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          {t('rec.interval')}
          <input
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            className={`${fieldClass} w-24`}
          />
          {t('rec.days')}
        </label>

        <button
          type="submit"
          disabled={busy || !name.trim() || !templateId}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          <Plus size={15} />
          {t('rec.add')}
        </button>
      </form>
      </Card>

      {items.length === 0 ? (
        <p className="text-text-secondary">{t('rec.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('rec.interval')}</th>
                <th className="py-2 pr-4 font-medium">{t('rec.nextRun')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 pr-4">{item.name}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">
                    {item.interval_days} {t('rec.days')}
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">
                    {new Date(item.next_run_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => remove(item.id)}
                      className="text-text-secondary hover:text-status-danger"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageScaffold>
  )
}
