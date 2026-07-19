/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Plus } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'
import type { User } from '../../types'
import { StatusBadge } from '../trainings'
import type { LmsCourse } from './courses'

interface LmsAssignment {
  id: string
  user_email: string | null
  course_title: string | null
  reason: string
  assigned_at: string
  due_at: string
  status: string
}

interface CampaignOpt {
  id: string
  name: string
  status: string
}

interface CampaignSettings {
  campaign_id: string
  score_threshold: number | null
  course_id: string | null
  due_days: number | null
  evaluated_at: string | null
}

const STATUSES = ['assigned', 'in_progress', 'quiz_pending', 'completed', 'overdue'] as const
const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'

export default function LmsAssignmentsPage() {
  const { t, lang } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<LmsAssignment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [courses, setCourses] = useState<LmsCourse[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [userId, setUserId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [dueDays, setDueDays] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Auto-Zuweisung je Kampagne (Spez. LMS-06)
  const [campaignId, setCampaignId] = useState('')
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings | null>(null)
  const [autoThreshold, setAutoThreshold] = useState('')
  const [autoCourseId, setAutoCourseId] = useState('')
  const [autoDueDays, setAutoDueDays] = useState('')
  const [autoSaved, setAutoSaved] = useState(false)

  function load() {
    const query = statusFilter ? `?status_filter=${statusFilter}` : ''
    api.get<LmsAssignment[]>(`/lms/assignments${query}`).then((r) => setItems(r.data))
  }

  useEffect(() => {
    if (!licensed) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licensed, statusFilter])

  useEffect(() => {
    if (!licensed) return
    api.get<User[]>('/users').then((r) => {
      const active = r.data.filter((u) => u.is_active)
      setUsers(active)
      // Vorbelegung aus dem Control-Center („LMS zuweisen“ bei Nicht bestanden):
      // ?email=… auf das passende Benutzerkonto mappen, falls vorhanden.
      const email = searchParams.get('email')?.toLowerCase()
      if (email) {
        const match = active.find((u) => u.email.toLowerCase() === email)
        if (match) setUserId((cur) => cur || match.id)
      }
    })
    api.get<LmsCourse[]>('/lms/courses').then((r) => setCourses(r.data.filter((c) => c.is_active)))
    api.get<CampaignOpt[]>('/campaigns').then((r) => setCampaigns(r.data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licensed])

  useEffect(() => {
    if (!campaignId) {
      setCampaignSettings(null)
      return
    }
    api.get<CampaignSettings>(`/lms/campaign-settings/${campaignId}`).then((r) => {
      setCampaignSettings(r.data)
      setAutoThreshold(r.data.score_threshold?.toString() ?? '')
      setAutoCourseId(r.data.course_id ?? '')
      setAutoDueDays(r.data.due_days?.toString() ?? '')
      setAutoSaved(false)
    })
  }, [campaignId])

  async function assign(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/lms/assignments', {
        user_id: userId,
        course_id: courseId,
        due_days: dueDays ? Number(dueDays) : null,
      })
      setUserId('')
      setCourseId('')
      setDueDays('')
      load()
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      setError(status === 409 ? t('lms.assign.duplicate') : t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  async function saveCampaignSettings(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.put<CampaignSettings>(`/lms/campaign-settings/${campaignId}`, {
        score_threshold: autoThreshold ? Number(autoThreshold) : null,
        course_id: autoCourseId || null,
        due_days: autoDueDays ? Number(autoDueDays) : null,
      })
      setCampaignSettings(res.data)
      setAutoSaved(true)
    } catch {
      setError(t('form.err.save'))
    } finally {
      setBusy(false)
    }
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('nav.lmsAssignments')} subtitle={t('lms.assign.subtitle')} guidanceKey="lms-assignments">
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB')

  return (
    <PageScaffold title={t('nav.lmsAssignments')} subtitle={t('lms.assign.subtitle')} guidanceKey="lms-assignments">
      {error && <p className="mb-3 text-sm text-status-danger">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-6">
        <Card className="max-w-xl flex-1" bodyClassName="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{t('lms.assign.new')}</h2>
          <form onSubmit={assign} className="flex flex-col gap-3">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} required className={fieldClass}>
              <option value="">{t('lms.assign.user')}…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required className={fieldClass}>
              <option value="">{t('lms.course')}…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              {t('lms.assign.dueDays')}
              <input
                type="number"
                min={1}
                max={365}
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                placeholder={t('lms.assign.dueDefault')}
                className={`${fieldClass} flex-1`}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !userId || !courseId}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              <Plus size={15} />
              {t('lms.assign.create')}
            </button>
          </form>
        </Card>

        <Card className="max-w-xl flex-1" bodyClassName="flex flex-col gap-3">
          <h2 className="text-sm font-medium">{t('lms.auto.title')}</h2>
          <p className="text-xs text-text-secondary">{t('lms.auto.hint')}</p>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={fieldClass}>
            <option value="">{t('lms.auto.campaign')}…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {campaignSettings && (
            <form onSubmit={saveCampaignSettings} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                {t('lms.auto.threshold')}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={autoThreshold}
                  onChange={(e) => setAutoThreshold(e.target.value)}
                  placeholder={t('lms.auto.thresholdOff')}
                  className={fieldClass}
                />
              </label>
              <select value={autoCourseId} onChange={(e) => setAutoCourseId(e.target.value)} className={fieldClass}>
                <option value="">{t('lms.course')}…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                {t('lms.assign.dueDays')}
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={autoDueDays}
                  onChange={(e) => setAutoDueDays(e.target.value)}
                  placeholder={t('lms.assign.dueDefault')}
                  className={`${fieldClass} flex-1`}
                />
              </label>
              <p className="text-xs text-text-secondary">
                {campaignSettings.evaluated_at
                  ? t('lms.auto.evaluated', { date: fmtDate(campaignSettings.evaluated_at) })
                  : t('lms.auto.notEvaluated')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy || (Boolean(autoThreshold) && !autoCourseId)}
                  className="inline-flex w-fit items-center rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {t('cw.save')}
                </button>
                {autoSaved && <span className="text-xs text-green-600">{t('lms.auto.saved')}</span>}
              </div>
            </form>
          )}
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={fieldClass}>
          <option value="">{t('lms.assign.all')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`lms.status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <p className="text-text-secondary">{t('lms.assign.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('lms.assign.user')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.course')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.status')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.due')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 pr-4">{item.user_email ?? '—'}</td>
                  <td className="py-2 pr-4">{item.course_title ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{fmtDate(item.due_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageScaffold>
  )
}
