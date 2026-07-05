/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FormEvent, useState } from 'react'
import { useI18n } from '../i18n'
import type { GroupSummary, LandingPage, SendingProfile, Template } from '../types'

export interface CampaignWizardValues {
  name: string
  template_id: string
  sending_profile_id: string | null
  landing_page_id: string | null
  group_ids: string[]
  scheduled_at: string | null
}

interface CampaignWizardProps {
  templates: Template[]
  profiles: SendingProfile[]
  pages: LandingPage[]
  groups: GroupSummary[]
  onSubmit: (values: CampaignWizardValues) => void
  onCancel: () => void
  submitting?: boolean
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-text-primary'
const labelClass = 'flex flex-col gap-1 text-sm'

export default function CampaignWizard({
  templates,
  profiles,
  pages,
  groups,
  onSubmit,
  onCancel,
  submitting,
}: CampaignWizardProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [profileId, setProfileId] = useState('')
  const [pageId, setPageId] = useState('')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')

  function toggleGroup(id: string) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Datum + Uhrzeit zu einem ISO-Zeitstempel kombinieren (Uhrzeit optional -> 00:00).
    const scheduledAt = scheduleDate
      ? new Date(`${scheduleDate}T${scheduleTime || '00:00'}`).toISOString()
      : null
    onSubmit({
      name,
      template_id: templateId,
      sending_profile_id: profileId || null,
      landing_page_id: pageId || null,
      group_ids: groupIds,
      scheduled_at: scheduledAt,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <label className={labelClass}>
        {t('common.name')}
        <input value={name} onChange={(e) => setName(e.target.value)} required className={fieldClass} />
      </label>

      <label className={labelClass}>
        {t('cw.template')}
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className={fieldClass}>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('cw.sendingProfile')}
        <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className={fieldClass}>
          <option value="">{t('cw.globalSmtp')}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('cw.landingPage')}
        <select value={pageId} onChange={(e) => setPageId(e.target.value)} className={fieldClass}>
          <option value="">{t('cw.none')}</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span>{t('nav.groups')}</span>
        {groups.length === 0 ? (
          <span className="text-text-secondary">{t('cw.noGroups')}</span>
        ) : (
          <div className="flex flex-col gap-1 rounded-md border border-border p-3">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2">
                <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                {g.name}
                <span className="font-mono text-xs text-text-secondary">({g.member_count})</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span>{t('cw.schedule')}</span>
        <div className="flex gap-3">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            className={`${fieldClass} flex-1`}
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            disabled={!scheduleDate}
            className={`${fieldClass} w-36 disabled:opacity-50`}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || groupIds.length === 0}
          className="rounded-md bg-accent px-5 py-2 font-medium text-white disabled:opacity-60"
        >
          {submitting ? t('cw.creating') : t('cw.create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-5 py-2 text-text-primary hover:bg-bg"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
