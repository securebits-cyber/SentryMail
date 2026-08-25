/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import AddonNotice from '../components/AddonNotice'
import BetaBadge from '../components/BetaBadge'
import Card from '../components/Card'
import LmsInteraction, {
  InteractionVerdict,
  NativeInteraction,
} from '../components/LmsInteraction'
import LmsVideoPlayer from '../components/LmsVideoPlayer'
import PageScaffold from '../components/PageScaffold'
import { useAddonState } from '../hooks/useFeatures'
import { useI18n } from '../i18n'
import { api } from '../services/api'

/**
 * Level-basierte Lernoberfläche (native Lernmodule).
 *
 * Eigener Zweig neben der bestehenden Kursansicht: Das Backend liefert sie
 * unter `/lms/my/native`, und solange der Schalter der Installation aus ist,
 * antwortet es dort mit 404. Diese Seite behandelt das als „nicht verfügbar",
 * nicht als Fehler.
 *
 * **Kein Überspringen:** Ob `Weiter` frei ist, entscheidet ausschließlich der
 * Server (`unlocked` je Level). Diese Seite zeigt den Zustand an, sie berechnet
 * ihn nicht.
 */

interface NativeLevel {
  id: string
  content_key: string | null
  sort_order: number
  title: string
  key_message: string
  body_text: string
  has_video: boolean
  duration_seconds: number | null
  has_subtitle: boolean
  coverage_threshold_percent: number
  interaction: NativeInteraction | null
  interaction_answered: boolean | null
  unlocked: boolean
}

interface NativeCourseView {
  assignment_id: string
  course: {
    id: string | null
    title: string | null
    content_key: string | null
    catalog_group: string | null
    locale: string | null
    version: number | null
    is_managed: boolean
  }
  levels: NativeLevel[]
  current_content_key: string | null
  levels_unlocked: number
  levels_total: number
}

export default function TrainingsNativePage() {
  const { t } = useI18n()
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const addon = useAddonState('enterprise')
  const licensed = addon === 'ready'

  const [view, setView] = useState<NativeCourseView | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [maxRate, setMaxRate] = useState(1.5)

  const load = useCallback(async () => {
    try {
      const res = await api.get<NativeCourseView>(`/lms/my/native/assignments/${assignmentId}`)
      setView(res.data)
      setActiveId((cur) => {
        if (cur) return cur
        const offen = res.data.levels.find((l) => l.content_key === res.data.current_content_key)
        return offen?.id ?? res.data.levels[0]?.id ?? null
      })
    } catch (err) {
      // 404 heißt hier zweierlei: Schalter aus oder Zuweisung nicht die eigene.
      // Beides ist für die lernende Person dasselbe — nichts anzuzeigen.
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        setUnavailable(true)
        return
      }
      throw err
    }
  }, [assignmentId])

  useEffect(() => {
    if (!licensed) return
    void load()
    // Die Wiedergabegeschwindigkeit steht in den LMS-Einstellungen; ohne
    // Adminrechte ist sie nicht lesbar, dann bleibt es beim Standard.
    api
      .get<{ max_playback_rate: number }>('/lms/settings')
      .then((res) => setMaxRate(res.data.max_playback_rate))
      .catch(() => undefined)
  }, [licensed, load])

  const level = view?.levels.find((l) => l.id === activeId) ?? null

  async function answer(response: Record<string, unknown>): Promise<InteractionVerdict> {
    const res = await api.post<InteractionVerdict>(
      `/lms/my/native/assignments/${assignmentId}/levels/${level?.id}/answer`,
      { response },
    )
    await load()
    return res.data
  }

  if (!licensed) {
    return (
      <PageScaffold title={t('lms.myTitle')} actions={<BetaBadge />}>
        <AddonNotice tier="enterprise" state={addon === 'missing' ? 'missing' : 'locked'} />
      </PageScaffold>
    )
  }

  if (unavailable) {
    return (
      <PageScaffold title={t('lms.myTitle')} actions={<BetaBadge />}>
        <Card>
          <p>{t('trainingsNative.unavailable')}</p>
          <Link
            to="/trainings"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={14} /> {t('lms.back')}
          </Link>
        </Card>
      </PageScaffold>
    )
  }

  if (!view) return <PageScaffold title={t('lms.myTitle')}>{null}</PageScaffold>

  return (
    <PageScaffold
      title={view.course.title ?? t('lms.myTitle')}
      subtitle={t('trainingsNative.progress')
        .replace('{done}', String(view.levels_unlocked))
        .replace('{total}', String(view.levels_total))}
      actions={<BetaBadge />}
    >
      <Link
        to="/trainings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        {t('lms.back')}
      </Link>

      {/* Level-Punkte statt Punktestand: eine Zahl je Person waere eine
          Leistungskennzahl. */}
      <ol className="native-levels" role="list">
        {view.levels.map((lvl) => (
          <li key={lvl.id}>
            <button
              type="button"
              className={`native-levels__dot${lvl.id === activeId ? ' is-active' : ''}${
                lvl.unlocked ? ' is-done' : ''
              }`}
              onClick={() => setActiveId(lvl.id)}
              aria-current={lvl.id === activeId}
              title={lvl.title}
            >
              {lvl.unlocked ? <CheckCircle2 size={16} /> : <span>{lvl.sort_order}</span>}
            </button>
          </li>
        ))}
      </ol>

      {level && (
        <Card title={level.title}>
          {level.key_message && <p className="native-level__key">{level.key_message}</p>}

          {level.has_video && (
            <LmsVideoPlayer
              assignmentId={view.assignment_id}
              moduleId={level.id}
              initialPosition={0}
              maxRate={maxRate}
              onProgress={() => void load()}
            />
          )}

          {level.body_text && <p className="native-level__body">{level.body_text}</p>}

          {level.interaction && (
            <LmsInteraction
              interaction={level.interaction}
              answered={level.interaction_answered ?? false}
              onAnswer={answer}
              labels={{
                submit: t('trainingsNative.submit'),
                submitting: t('trainingsNative.submitting'),
                again: t('trainingsNative.again'),
                answered: t('trainingsNative.answered'),
                correct: t('trainingsNative.correct'),
                incorrect: t('trainingsNative.incorrect'),
                noted: t('trainingsNative.noted'),
                timeLeft: t('trainingsNative.timeLeft'),
                pickAtLeastOne: t('trainingsNative.pickAtLeastOne'),
                foundOf: t('trainingsNative.foundOf'),
              }}
            />
          )}

          {!level.unlocked && (
            <p className="native-level__locked">
              <Lock size={16} /> {t('trainingsNative.locked')}
            </p>
          )}
        </Card>
      )}
    </PageScaffold>
  )
}
