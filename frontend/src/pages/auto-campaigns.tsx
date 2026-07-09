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

interface AutoCampaign {
  id: string
  name: string
  risk_target: string
  interval_days: number
  next_run_at: string
  enabled: boolean
}

const RISK_TARGETS = ['submitted', 'clicked', 'all'] as const
const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'

export default function AutoCampaignsPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [items, setItems] = useState<AutoCampaign[]>([])
  const [templates, setTemplates] = useState<Opt[]>([])
  const [profiles, setProfiles] = useState<Opt[]>([])
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [riskTarget, setRiskTarget] = useState<string>('clicked')
  const [interval, setInterval] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    api.get<AutoCampaign[]>('/auto-campaigns').then((r) => setItems(r.data))
  }

  useEffect(() => {
    if (!licensed) return
    load()
    api.get<Opt[]>('/templates').then((r) => setTemplates(r.data))
    api.get<Opt[]>('/sending-profiles').then((r) => setProfiles(r.data))
  }, [licensed])

  async function add(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/auto-campaigns', {
        name,
        template_id: templateId,
        sending_profile_id: profileId || null,
        risk_target: riskTarget,
        interval_days: interval,
      })
      setName('')
      setTemplateId('')
      setProfileId('')
      setRiskTarget('clicked')
      setInterval(30)
      load()
    } catch {
      setError(t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    await api.delete(`/auto-campaigns/${id}`)
    load()
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('ac.title')} subtitle={t('ac.subtitle')} guidanceKey="auto-campaigns">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )

  return (
    <PageScaffold title={t('ac.title')} subtitle={t('ac.subtitle')} guidanceKey="auto-campaigns">
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      <Card className="mb-8 max-w-xl">
      <form onSubmit={add} className="flex flex-col gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('ac.name')} className={fieldClass} />

        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className={fieldClass}>
          <option value="">{t('rec.template')}…</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
          ))}
        </select>

        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={fieldClass}>
          <option value="">{t('rec.profileDefault')}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <label className="flex flex-col gap-1 text-sm text-text-secondary">
          {t('ac.riskTarget')}
          <select value={riskTarget} onChange={(e) => setRiskTarget(e.target.value)} className={fieldClass}>
            {RISK_TARGETS.map((rt) => (
              <option key={rt} value={rt}>{t(`ac.risk.${rt}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          {t('ac.interval')}
          <input type="number" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value))} className={`${fieldClass} w-24`} />
          {t('rec.days')}
        </label>

        <button type="submit" disabled={busy || !name.trim() || !templateId} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          <Plus size={15} />
          {t('ac.create')}
        </button>
      </form>
      </Card>

      {items.length === 0 ? (
        <p className="text-text-secondary">{t('ac.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('ac.riskTarget')}</th>
                <th className="py-2 pr-4 font-medium">{t('ac.nextRun')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 pr-4">{item.name}</td>
                  <td className="py-2 pr-4 text-text-secondary">{t(`ac.risk.${item.risk_target}`)}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{item.next_run_at.slice(0, 10)}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => remove(item.id)} className="text-text-secondary hover:text-status-danger" aria-label={t('common.delete')}>
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
