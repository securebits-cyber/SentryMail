/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { api, csrfToken } from '../services/api'

interface ProgressResponse {
  accepted: boolean
  coverage_percent: number
  assignment_status: string
}

interface LmsVideoPlayerProps {
  assignmentId: string
  moduleId: string
  /** Startposition (letzte bekannte Position vom Server). */
  initialPosition: number
  /** Maximal erlaubte Wiedergabegeschwindigkeit (LMS-Einstellung). */
  maxRate: number
  /** Serverantwort auf Progress-Events (Coverage/Status) nach oben reichen. */
  onProgress?: (update: ProgressResponse) => void
}

const FLUSH_INTERVAL_MS = 10_000

/** Neues Intervall [start, ende) in eine sortierte, disjunkte Liste mergen. */
function mergeSegment(segments: [number, number][], start: number, end: number): [number, number][] {
  if (end <= start) return segments
  const merged: [number, number][] = []
  let [s, e] = [start, end]
  for (const [a, b] of segments) {
    if (b < s || a > e) {
      merged.push([a, b])
    } else {
      s = Math.min(s, a)
      e = Math.max(e, b)
    }
  }
  merged.push([s, e])
  merged.sort((x, y) => x[0] - y[0])
  return merged
}

/**
 * HTML5-Player für Pflichtschulungen (LMS, Enterprise).
 *
 * Es zählt nur tatsächlich gesehene Wiedergabezeit: Der Player führt ein
 * lokales Watched-Segments-Bitfeld und meldet alle 10 s (und bei pause/
 * seeked/ended/Seitenverlassen) Position + neu gesehene Segmente an den
 * Server — der die autoritative Map führt und Deltas plausibilisiert.
 * Download-Button und Kontextmenü sind deaktiviert (Hürde, kein absoluter
 * Schutz); bei inaktivem Tab wird pausiert, die Geschwindigkeit ist begrenzt.
 */
export default function LmsVideoPlayer({
  assignmentId,
  moduleId,
  initialPosition,
  maxRate,
  onProgress,
}: LmsVideoPlayerProps) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  // Tracking-Zustand bewusst in Refs (kein Re-Render pro timeupdate).
  const lastTimeRef = useRef<number | null>(null)
  const pendingSegsRef = useRef<[number, number][]>([])
  const deltaRef = useRef(0)
  const resumeAtRef = useRef(initialPosition)

  const progressUrl = `/lms/my/assignments/${assignmentId}/modules/${moduleId}/progress`

  const fetchStreamUrl = useCallback(async () => {
    const res = await api.post<{ url: string }>(
      `/lms/my/assignments/${assignmentId}/modules/${moduleId}/stream-url`,
    )
    setSrc(`${import.meta.env.VITE_API_URL}${res.data.url}`)
  }, [assignmentId, moduleId])

  useEffect(() => {
    fetchStreamUrl().catch(() => setError(true))
  }, [fetchStreamUrl])

  const flush = useCallback(
    async (useBeacon = false) => {
      const video = videoRef.current
      const segments = pendingSegsRef.current
      const delta = Math.round(deltaRef.current)
      if (!video || (segments.length === 0 && delta === 0)) return
      pendingSegsRef.current = []
      deltaRef.current = 0
      const body = {
        position_seconds: Math.floor(video.currentTime),
        watched_delta_seconds: delta,
        segments,
      }
      try {
        if (useBeacon) {
          // Seitenverlassen: keepalive-fetch statt sendBeacon (CSRF-Header nötig).
          void fetch(`${import.meta.env.VITE_API_URL}${progressUrl}`, {
            method: 'POST',
            keepalive: true,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() ?? '' },
            body: JSON.stringify(body),
          })
        } else {
          const res = await api.post<ProgressResponse>(progressUrl, body)
          onProgress?.(res.data)
        }
      } catch {
        /* Progress-Fehler sind nicht fatal — nächster Flush versucht es erneut. */
      }
    },
    [onProgress, progressUrl],
  )

  useEffect(() => {
    const interval = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS)
    const onHide = () => {
      // Hintergrund-Abspielen zählt nicht: bei inaktivem Tab pausieren.
      if (document.visibilityState === 'hidden') {
        videoRef.current?.pause()
        void flush(true)
      }
    }
    const onUnload = () => void flush(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onUnload)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onUnload)
      void flush()
    }
  }, [flush])

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video || video.paused || video.seeking) return
    const cur = video.currentTime
    const last = lastTimeRef.current
    // Nur kontinuierliche Wiedergabe zählen (kein Sprung, keine Rückwärtszeit).
    if (last !== null && cur > last && cur - last < 3) {
      pendingSegsRef.current = mergeSegment(pendingSegsRef.current, Math.floor(last), Math.ceil(cur))
      deltaRef.current += cur - last
    }
    lastTimeRef.current = cur
  }

  function handleRateChange() {
    const video = videoRef.current
    if (video && video.playbackRate > maxRate) video.playbackRate = maxRate
  }

  async function handleError() {
    // Signierte URL abgelaufen (TTL) -> neue URL holen und Position halten.
    const video = videoRef.current
    if (video) resumeAtRef.current = video.currentTime || resumeAtRef.current
    try {
      await fetchStreamUrl()
    } catch {
      setError(true)
    }
  }

  if (error) return <p className="text-sm text-status-danger">{t('lms.noVideo')}</p>
  if (!src) return <p className="text-sm text-text-secondary">{t('dash.loading')}</p>

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      onLoadedMetadata={() => {
        const video = videoRef.current
        if (video && resumeAtRef.current > 0 && resumeAtRef.current < video.duration - 1) {
          video.currentTime = resumeAtRef.current
        }
      }}
      onTimeUpdate={handleTimeUpdate}
      onSeeked={() => {
        lastTimeRef.current = videoRef.current?.currentTime ?? null
      }}
      onPause={() => {
        lastTimeRef.current = null
        void flush()
      }}
      onPlay={() => {
        lastTimeRef.current = videoRef.current?.currentTime ?? null
      }}
      onEnded={() => void flush()}
      onRateChange={handleRateChange}
      onError={() => void handleError()}
      className="w-full rounded-lg border border-border bg-black"
    />
  )
}
