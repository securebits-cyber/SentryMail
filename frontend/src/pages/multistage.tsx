/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Play, Plus, Trash2, X } from 'lucide-react'
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

interface Stage {
  template_id: string
  delay_days: number
}

interface MultiStage {
  id: string
  name: string
  stages: Stage[]
  started_at: string | null
  sent_count: number
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'

export default function MultiStagePage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.business)
  const [items, setItems] = useState<MultiStage[]>([])
  const [templates, setTemplates] = useState<Opt[]>([])
  const [groups, setGroups] = useState<Opt[]>([])
  const [profiles, setProfiles] = useState<Opt[]>([])
  const [name, setName] = useState('')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [profileId, setProfileId] = useState('')
  const [stages, setStages] = useState<Stage[]>([{ template_id: '', delay_days: 0 }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    api.get<MultiStage[]>('/multistage').then((r) => setItems(r.data))
  }

  useEffect(() => {
    if (!licensed) return
    load()
    api.get<Opt[]>('/templates').then((r) => setTemplates(r.data))
    api.get<Opt[]>('/groups').then((r) => setGroups(r.data))
    api.get<Opt[]>('/sending-profiles').then((r) => setProfiles(r.data))
  }, [licensed])

  function toggleGroup(id: string) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function setStage(i: number, patch: Partial<Stage>) {
    setStages((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/multistage', {
        name,
        group_ids: groupIds,
        sending_profile_id: profileId || null,
        stages: stages.filter((s) => s.template_id),
      })
      setName('')
      setGroupIds([])
      setProfileId('')
      setStages([{ template_id: '', delay_days: 0 }])
      load()
    } catch {
      setError(t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  async function start(id: string) {
    await api.post(`/multistage/${id}/start`)
    load()
  }

  async function remove(id: string) {
    await api.delete(`/multistage/${id}`)
    load()
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('ms.title')} subtitle={t('ms.subtitle')} guidanceKey="multistage">
        <LockedFeatureNotice tier="business" />
      </PageScaffold>
    )

  return (
    <PageScaffold title={t('ms.title')} subtitle={t('ms.subtitle')} guidanceKey="multistage">
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      <Card className="mb-8 max-w-2xl">
      <form onSubmit={add} className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('ms.name')} className={fieldClass} />

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

        <div className="rounded-md border border-border p-3">
          <div className="mb-2 text-sm text-text-secondary">{t('ms.stages')}</div>
          <div className="flex flex-col gap-2">
            {stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-sm text-text-secondary">{i + 1}.</span>
                <select
                  value={stage.template_id}
                  onChange={(e) => setStage(i, { template_id: e.target.value })}
                  className={`${fieldClass} flex-1`}
                >
                  <option value="">{t('rec.template')}…</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={stage.delay_days}
                  onChange={(e) => setStage(i, { delay_days: Number(e.target.value) })}
                  className={`${fieldClass} w-20`}
                  title={t('ms.delay')}
                />
                <span className="text-xs text-text-secondary">{t('rec.days')}</span>
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setStages((prev) => prev.filter((_, j) => j !== i))}
                    className="text-text-secondary hover:text-status-danger"
                    aria-label={t('common.delete')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStages((prev) => [...prev, { template_id: '', delay_days: 7 }])}
            className="mt-2 inline-flex items-center gap-1 text-sm text-accent"
          >
            <Plus size={14} />
            {t('ms.addStage')}
          </button>
        </div>

        <button
          type="submit"
          disabled={busy || !name.trim() || !stages.some((s) => s.template_id)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          <Plus size={15} />
          {t('ms.create')}
        </button>
      </form>
      </Card>

      {items.length === 0 ? (
        <p className="text-text-secondary">{t('ms.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('ms.progress')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 pr-4">{item.name}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">
                    {item.started_at ? `${item.sent_count}/${item.stages.length}` : t('ms.notStarted')}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {!item.started_at && (
                      <button onClick={() => start(item.id)} className="mr-3 inline-flex items-center gap-1 text-accent hover:underline">
                        <Play size={13} />
                        {t('ms.start')}
                      </button>
                    )}
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
