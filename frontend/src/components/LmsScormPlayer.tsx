/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import BetaBadge from './BetaBadge'
import Card from './Card'
import { useI18n } from '../i18n'
import { api } from '../services/api'

interface ScormLaunch {
  url: string
  expires_at: string
  title: string
  lesson_status: string
  total_time_seconds: number
}

interface ScormCommit {
  lesson_status: string
  lesson_location: string
  score_raw: string
  score_min: string
  score_max: string
  suspend_data: string
  session_time: string
  final: boolean
}

/**
 * SCORM-Kurs im abgeschotteten Rahmen (Beta).
 *
 * **Der Rahmen läuft ohne `allow-same-origin`.** Der Kursinhalt ist fremdes
 * JavaScript; mit derselben Herkunft wie die Anwendung könnte er das CSRF-Cookie
 * lesen und mit der Sitzung der Person beliebige Aufrufe machen. So bekommt er
 * eine eigene, undurchsichtige Herkunft und sieht keine Cookies.
 *
 * Der Kurs meldet seinen Fortschritt per `postMessage`; diese Komponente gibt ihn
 * mit der Sitzung an den Server weiter. Damit liegt kein Token im Kursinhalt.
 * Geprüft wird, dass die Nachricht **aus genau diesem Rahmen** kommt — die
 * Herkunft ist bei einem abgeschotteten Rahmen immer „null" und taugt nicht als
 * Prüfmerkmal.
 */
export default function LmsScormPlayer({
  assignmentId,
  moduleId,
  onProgress,
}: {
  assignmentId: string
  moduleId: string
  onProgress: (update: { lesson_status: string; assignment_status: string }) => void
}) {
  const { t } = useI18n()
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [launch, setLaunch] = useState<ScormLaunch | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .post<ScormLaunch>(`/lms/my/assignments/${assignmentId}/modules/${moduleId}/scorm-launch`)
      .then((res) => {
        if (!cancelled) setLaunch(res.data)
      })
      .catch(() => {
        if (!cancelled) setError(t('lms.scorm.err.launch'))
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId, moduleId, t])

  const commit = useCallback(
    async (payload: ScormCommit) => {
      try {
        const res = await api.post<{ lesson_status: string; assignment_status: string }>(
          `/lms/my/assignments/${assignmentId}/modules/${moduleId}/scorm`,
          payload,
        )
        onProgress(res.data)
      } catch {
        // Kein Abbruch der Lektion: Die Person hat den Fehler nicht gemacht, und
        // der Kurs meldet beim nächsten Commit ohnehin erneut.
        setError(t('lms.scorm.err.commit'))
      }
    },
    [assignmentId, moduleId, onProgress, t],
  )

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Die Herkunft ist bei einem abgeschotteten Rahmen "null" und damit kein
      // Prüfmerkmal. Entscheidend ist, dass die Nachricht aus genau diesem
      // Rahmen kommt.
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return
      const data = event.data as { type?: string; payload?: ScormCommit }
      if (data?.type !== 'sentrymail-scorm-commit' || !data.payload) return
      void commit(data.payload)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [commit])

  if (error && !launch)
    return (
      <Card>
        <p className="text-sm text-status-danger">{error}</p>
      </Card>
    )
  if (!launch) return <p className="text-sm text-text-secondary">{t('dash.loading')}</p>

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{launch.title}</span>
        <BetaBadge />
        <span className="text-text-secondary">
          {t('lms.scorm.status', { status: t(`lms.scorm.status.${launch.lesson_status}`) })}
        </span>
      </div>

      <iframe
        ref={frameRef}
        title={launch.title}
        src={`${import.meta.env.VITE_API_URL}${launch.url}`}
        // Ohne allow-same-origin: Der Kurs bekommt eine eigene, undurchsichtige
        // Herkunft und sieht die Cookies der Anwendung nicht. allow-forms, weil
        // viele Kurse ihre Antwortbögen als Formular bauen.
        sandbox="allow-scripts allow-forms allow-popups"
        className="h-[70vh] w-full rounded-lg border border-border bg-white"
      />

      {error && <p className="text-xs text-status-danger">{error}</p>}

      <p className="flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/8 p-3 text-xs text-text-secondary">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-status-warning" />
        {t('lms.scorm.betaNote')}
      </p>
    </div>
  )
}
