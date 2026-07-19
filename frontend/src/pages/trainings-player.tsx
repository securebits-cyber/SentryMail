/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ArrowLeft, CheckCircle2, FileDown } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Card from '../components/Card'
import LmsQuiz from '../components/LmsQuiz'
import LmsVideoPlayer from '../components/LmsVideoPlayer'
import LockedFeatureNotice from '../components/LockedFeatureNotice'
import PageScaffold from '../components/PageScaffold'
import { useFeatures } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'
import { StatusBadge, downloadCertificate } from './trainings'

interface MyModule {
  id: string
  title: string
  sort_order: number
  has_video: boolean
  video_duration_seconds: number | null
  quiz_required: boolean
  coverage_percent: number
  last_position_seconds: number
}

interface MyAssignmentDetail {
  id: string
  course_title: string | null
  status: string
  due_at: string
  completed_at: string | null
  completion_id: string | null
  modules: MyModule[]
  completion_coverage_percent: number
  max_playback_rate: number
  quiz_pass_percent: number
}

export default function TrainingPlayerPage() {
  const { t } = useI18n()
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [detail, setDetail] = useState<MyAssignmentDetail | null>(null)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await api.get<MyAssignmentDetail>(`/lms/my/assignments/${assignmentId}`)
    setDetail(res.data)
    // Erstes Modul mit Video vorauswählen (falls noch keins gewählt).
    setActiveModuleId((cur) => cur ?? res.data.modules.find((m) => m.has_video)?.id ?? null)
  }, [assignmentId])

  useEffect(() => {
    if (licensed && assignmentId) void load()
  }, [licensed, assignmentId, load])

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('lms.myTitle')}>
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )
  if (!detail) return <p className="text-text-secondary">{t('dash.loading')}</p>

  const active = detail.modules.find((m) => m.id === activeModuleId) ?? null
  const playable = detail.status !== 'completed'

  return (
    <PageScaffold
      title={detail.course_title ?? t('lms.myTitle')}
      subtitle={t('lms.playerNote')}
      actions={<StatusBadge status={detail.status} />}
    >
      <Link to="/trainings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft size={14} />
        {t('lms.back')}
      </Link>

      {detail.status === 'quiz_pending' && (
        <div className="mb-6 max-w-2xl">
          <LmsQuiz assignmentId={detail.id} passPercent={detail.quiz_pass_percent} onPassed={() => void load()} />
        </div>
      )}
      {detail.status === 'completed' && (
        <div className="mb-4 flex max-w-2xl items-center justify-between gap-3 rounded-md border border-green-600 bg-green-600/10 px-3 py-2 text-sm text-green-600">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            {t('lms.completedHint')}
          </span>
          {detail.completion_id && (
            <button
              onClick={() => void downloadCertificate(detail.completion_id!)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-green-600 px-3 py-1 text-xs hover:bg-green-600/10"
            >
              <FileDown size={14} />
              {t('lms.certificate')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {active && playable ? (
            <LmsVideoPlayer
              key={active.id}
              assignmentId={detail.id}
              moduleId={active.id}
              initialPosition={active.last_position_seconds}
              maxRate={detail.max_playback_rate}
              onProgress={(update) => {
                // Serverantwort in die Modulliste spiegeln; bei Statuswechsel
                // (completed/quiz_pending) den kompletten Stand neu laden.
                setDetail((cur) => {
                  if (!cur) return cur
                  if (update.assignment_status !== cur.status) void load()
                  return {
                    ...cur,
                    status: update.assignment_status,
                    modules: cur.modules.map((m) =>
                      m.id === active.id ? { ...m, coverage_percent: update.coverage_percent } : m,
                    ),
                  }
                })
              }}
            />
          ) : (
            active === null && <p className="text-text-secondary">{t('lms.noVideo')}</p>
          )}
        </div>

        <Card className="w-full shrink-0 lg:w-80" bodyClassName="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t('lms.modules')}</h2>
          {detail.modules.length === 0 && <p className="text-sm text-text-secondary">{t('lms.noVideo')}</p>}
          {detail.modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModuleId(m.id)}
              disabled={!m.has_video}
              className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                m.id === activeModuleId ? 'border-accent bg-accent/10' : 'border-border hover:bg-bg'
              }`}
            >
              <span className="truncate">{m.title}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
                {m.has_video ? `${Math.floor(m.coverage_percent)} %` : '—'}
              </span>
            </button>
          ))}
          <div className="mt-2 border-t border-border pt-2 text-xs text-text-secondary">
            {t('lms.progress')}: ≥ {detail.completion_coverage_percent} %
          </div>
        </Card>
      </div>
    </PageScaffold>
  )
}
