/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ExternalLink, ListChecks, Plus, Trash2, Upload } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Card from '../../components/Card'
import LockedFeatureNotice from '../../components/LockedFeatureNotice'
import PageScaffold from '../../components/PageScaffold'
import { useFeatures } from '../../hooks/useFeatures'
import { useI18n } from '../../i18n'
import { api } from '../../services/api'

export interface LmsCourse {
  id: string
  title: string
  description: string
  version: number
  is_active: boolean
  module_count: number
}

interface LmsModule {
  id: string
  title: string
  sort_order: number
  has_video: boolean
  video_duration_seconds: number | null
  quiz_required: boolean
}

interface LmsCourseDetail extends LmsCourse {
  modules: LmsModule[]
}

const fieldClass = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary'

function fmtDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')} min`
}

interface QuizQuestionDraft {
  question_text: string
  options: string[]
  correct_option: number
}

/** Quiz-Editor eines Moduls: lädt die Fragen (inkl. Lösungen, Admin-Sicht)
 *  und ersetzt sie beim Speichern komplett (POST-Semantik des Backends). */
function QuizEditor({ moduleId }: { moduleId: string }) {
  const { t } = useI18n()
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await api.get<QuizQuestionDraft[]>(`/lms/modules/${moduleId}/quiz`)
    setQuestions(
      res.data.map((q) => ({ question_text: q.question_text, options: [...q.options], correct_option: q.correct_option })),
    )
  }, [moduleId])

  useEffect(() => {
    void load()
  }, [load])

  function patch(qi: number, update: Partial<QuizQuestionDraft>) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, ...update } : q)))
    setSaved(false)
  }

  async function save() {
    setBusy(true)
    try {
      const valid = questions
        .map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) }))
        .filter((q) => q.question_text.trim() && q.options.length >= 2)
        .map((q) => ({ ...q, correct_option: Math.min(q.correct_option, q.options.length - 1) }))
      await api.post(`/lms/modules/${moduleId}/quiz`, { questions: valid })
      await load()
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border border-border bg-bg p-3">
      <p className="text-xs text-text-secondary">{t('lms.quiz.correct')}</p>
      {questions.map((question, qi) => (
        <div key={qi} className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2">
          <div className="flex items-center gap-2">
            <input
              value={question.question_text}
              onChange={(e) => patch(qi, { question_text: e.target.value })}
              placeholder={t('lms.quiz.questionPlaceholder')}
              className={`${fieldClass} flex-1`}
            />
            <button
              onClick={() => {
                setQuestions((prev) => prev.filter((_, i) => i !== qi))
                setSaved(false)
              }}
              className="text-text-secondary hover:text-status-danger"
              aria-label={t('common.delete')}
            >
              <Trash2 size={14} />
            </button>
          </div>
          {question.options.map((option, oi) => (
            <div key={oi} className="ml-4 flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${moduleId}-${qi}`}
                checked={question.correct_option === oi}
                onChange={() => patch(qi, { correct_option: oi })}
              />
              <input
                value={option}
                onChange={(e) =>
                  patch(qi, { options: question.options.map((o, i) => (i === oi ? e.target.value : o)) })
                }
                placeholder={t('lms.quiz.optionPlaceholder')}
                className={`${fieldClass} flex-1`}
              />
            </div>
          ))}
          {question.options.length < 6 && (
            <button
              onClick={() => patch(qi, { options: [...question.options, ''] })}
              className="ml-4 w-fit text-xs text-text-secondary hover:text-text-primary"
            >
              + {t('lms.quiz.addOption')}
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setQuestions((prev) => [...prev, { question_text: '', options: ['', ''], correct_option: 0 }])
            setSaved(false)
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-surface"
        >
          <Plus size={13} />
          {t('lms.quiz.addQuestion')}
        </button>
        <button
          onClick={() => void save()}
          disabled={busy}
          className="inline-flex items-center rounded-full bg-accent px-4 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {t('cw.save')}
        </button>
        {saved && <span className="text-xs text-green-600">{t('lms.quiz.saved')}</span>}
      </div>
    </div>
  )
}

/** Ein Modul-Eintrag mit Upload (Multipart mit Fortschrittsanzeige) und Vorschau. */
function ModuleRow({ courseId, module, onChanged }: { courseId: string; module: LmsModule; onChanged: () => void }) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)

  async function upload(file: File) {
    setUploadError(false)
    setUploadPercent(0)
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/lms/courses/${courseId}/modules/${module.id}/video`, form, {
        onUploadProgress: (e) => setUploadPercent(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
      })
      onChanged()
    } catch {
      setUploadError(true)
    } finally {
      setUploadPercent(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function preview() {
    const res = await api.post<{ url: string }>(`/lms/courses/${courseId}/modules/${module.id}/stream-url`)
    window.open(`${import.meta.env.VITE_API_URL}${res.data.url}`, '_blank', 'noopener')
  }

  async function remove() {
    await api.delete(`/lms/courses/${courseId}/modules/${module.id}`)
    onChanged()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{module.title}</span>
      {module.quiz_required && (
        <span className="rounded-full bg-sunken px-2 py-0.5 text-xs text-text-secondary">{t('lms.modules.quizRequired')}</span>
      )}
      <span className="text-xs text-text-secondary">
        {module.has_video
          ? t('lms.modules.hasVideo', { duration: fmtDuration(module.video_duration_seconds) })
          : t('lms.modules.noVideo')}
      </span>
      {uploadPercent !== null ? (
        <span className="font-mono text-xs tabular-nums text-accent-text">
          {t('lms.modules.uploading', { percent: uploadPercent })}
        </span>
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-bg"
          >
            <Upload size={13} />
            {t('lms.modules.upload')}
          </button>
          {module.has_video && (
            <button
              onClick={() => void preview()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-bg"
            >
              <ExternalLink size={13} />
              {t('lms.modules.preview')}
            </button>
          )}
          {module.quiz_required && (
            <button
              onClick={() => setQuizOpen((open) => !open)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                quizOpen ? 'border-accent text-accent-text' : 'border-border hover:bg-bg'
              }`}
            >
              <ListChecks size={13} />
              {t('lms.quiz.edit')}
            </button>
          )}
          <button onClick={() => void remove()} className="text-text-secondary hover:text-status-danger" aria-label={t('common.delete')}>
            <Trash2 size={14} />
          </button>
        </>
      )}
      {uploadError && <span className="w-full text-xs text-status-danger">{t('lms.modules.uploadError')}</span>}
      {quizOpen && <QuizEditor moduleId={module.id} />}
    </div>
  )
}

export default function LmsCoursesPage() {
  const { t } = useI18n()
  const features = useFeatures()
  const licensed = Boolean(features?.features?.enterprise)
  const [courses, setCourses] = useState<LmsCourse[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<LmsCourseDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleQuiz, setModuleQuiz] = useState(false)
  const [busy, setBusy] = useState(false)

  function loadCourses() {
    api.get<LmsCourse[]>('/lms/courses').then((r) => setCourses(r.data))
  }

  function loadDetail(id: string) {
    api.get<LmsCourseDetail>(`/lms/courses/${id}`).then((r) => setDetail(r.data))
  }

  useEffect(() => {
    if (licensed) loadCourses()
  }, [licensed])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId])

  async function createCourse(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const res = await api.post<LmsCourse>('/lms/courses', { title, description })
      setTitle('')
      setDescription('')
      loadCourses()
      setSelectedId(res.data.id)
    } finally {
      setBusy(false)
    }
  }

  async function createModule(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true)
    try {
      await api.post(`/lms/courses/${selectedId}/modules`, {
        title: moduleTitle,
        sort_order: detail?.modules.length ?? 0,
        quiz_required: moduleQuiz,
      })
      setModuleTitle('')
      setModuleQuiz(false)
      loadDetail(selectedId)
      loadCourses()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(course: LmsCourse) {
    await api.patch(`/lms/courses/${course.id}`, { is_active: !course.is_active })
    loadCourses()
    if (selectedId === course.id) loadDetail(course.id)
  }

  if (features === null) return <p className="text-text-secondary">{t('dash.loading')}</p>
  if (!licensed)
    return (
      <PageScaffold title={t('nav.lmsCourses')} subtitle={t('lms.courses.subtitle')}>
        <LockedFeatureNotice tier="enterprise" />
      </PageScaffold>
    )

  return (
    <PageScaffold title={t('nav.lmsCourses')} subtitle={t('lms.courses.subtitle')}>
      <Card className="mb-6 max-w-xl">
        <form onSubmit={createCourse} className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={t('common.name')}
            className={fieldClass}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('lms.courses.description')}
            rows={2}
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            <Plus size={15} />
            {t('lms.courses.new')}
          </button>
        </form>
      </Card>

      {courses.length === 0 ? (
        <p className="text-text-secondary">{t('lms.courses.empty')}</p>
      ) : (
        <Card bodyClassName="overflow-x-auto" className="mb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="py-2 pr-4 font-medium">{t('common.name')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.courses.version')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.modules')}</th>
                <th className="py-2 pr-4 font-medium">{t('lms.status')}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.id}
                  onClick={() => setSelectedId(course.id)}
                  className={`cursor-pointer border-b border-border ${selectedId === course.id ? 'bg-accent/5' : 'hover:bg-bg'}`}
                >
                  <td className="py-2 pr-4">{course.title}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">v{course.version}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums text-text-secondary">{course.module_count}</td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void toggleActive(course)
                      }}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        course.is_active ? 'bg-green-600/10 text-green-600' : 'bg-sunken text-text-secondary'
                      }`}
                    >
                      {course.is_active ? t('lms.courses.active') : t('lms.courses.inactive')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {detail === null ? (
        courses.length > 0 && <p className="text-sm text-text-secondary">{t('lms.courses.select')}</p>
      ) : (
        <Card className="max-w-3xl" bodyClassName="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            {detail.title} — {t('lms.modules')}
          </h2>
          {detail.modules.length === 0 && <p className="text-sm text-text-secondary">{t('lms.modules.empty')}</p>}
          {detail.modules.map((m) => (
            <ModuleRow key={m.id} courseId={detail.id} module={m} onChanged={() => loadDetail(detail.id)} />
          ))}
          <form onSubmit={createModule} className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <input
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              required
              placeholder={t('lms.modules.title')}
              className={`${fieldClass} min-w-56 flex-1`}
            />
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={moduleQuiz} onChange={(e) => setModuleQuiz(e.target.checked)} />
              {t('lms.modules.quizRequired')}
            </label>
            <button
              type="submit"
              disabled={busy || !moduleTitle.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Plus size={14} />
              {t('lms.modules.new')}
            </button>
          </form>
        </Card>
      )}
    </PageScaffold>
  )
}
