/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { CheckCircle2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Card from './Card'
import { useI18n } from '../i18n'
import { api } from '../services/api'

interface QuizOption {
  index: number
  text: string
}

interface QuizQuestion {
  id: string
  question_text: string
  options: QuizOption[]
}

interface QuizResult {
  passed: boolean
  score_percent: number
  required_percent: number
  assignment_status: string
}

/**
 * Verständnis-Quiz nach Erreichen der Wiedergabe-Schwelle (Quiz-Gate).
 * Fragen kommen ohne Lösungen vom Server (randomisiert); bewertet wird
 * ausschließlich serverseitig. Bei Nichtbestehen ist die Wiederholung möglich.
 */
export default function LmsQuiz({
  assignmentId,
  passPercent,
  onPassed,
}: {
  assignmentId: string
  passPercent: number
  onPassed: () => void
}) {
  const { t } = useI18n()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await api.get<QuizQuestion[]>(`/lms/my/assignments/${assignmentId}/quiz`)
    setQuestions(res.data)
    setAnswers({})
    setResult(null)
  }, [assignmentId])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    setBusy(true)
    try {
      const res = await api.post<QuizResult>(`/lms/my/assignments/${assignmentId}/quiz`, {
        answers: Object.entries(answers).map(([question_id, selected_option]) => ({
          question_id,
          selected_option,
        })),
      })
      setResult(res.data)
      if (res.data.passed) onPassed()
    } finally {
      setBusy(false)
    }
  }

  if (result?.passed) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-green-600 bg-green-600/10 px-3 py-2 text-sm text-green-600">
        <CheckCircle2 size={16} className="shrink-0" />
        {t('lms.quiz.passed', { score: result.score_percent })}
      </p>
    )
  }

  return (
    <Card title={t('lms.quiz.title')} subtitle={t('lms.quiz.intro', { percent: passPercent })} bodyClassName="flex flex-col gap-4">
      {questions.map((question, qi) => (
        <fieldset key={question.id} className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">
            {qi + 1}. {question.question_text}
          </legend>
          {question.options.map((option) => (
            <label key={option.index} className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === option.index}
                onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.index }))}
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      ))}

      {result && !result.passed && (
        <p className="flex items-center gap-2 rounded-md border border-status-danger bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          <XCircle size={16} className="shrink-0" />
          {t('lms.quiz.failed', { score: result.score_percent, required: result.required_percent })}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => void submit()}
          disabled={busy || Object.keys(answers).length < questions.length}
          className="inline-flex w-fit items-center rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {t('lms.quiz.submit')}
        </button>
        {result && !result.passed && (
          <button
            onClick={() => void load()}
            className="rounded-full border border-border px-5 py-2 text-sm text-text-primary hover:bg-bg"
          >
            {t('lms.quiz.retry')}
          </button>
        )}
      </div>
    </Card>
  )
}
