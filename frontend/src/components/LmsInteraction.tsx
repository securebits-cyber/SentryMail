/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { CheckCircle2, Circle, Info, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

/**
 * Die Interaktion eines nativen Levels.
 *
 * Drei Grundformen, alle **serverseitig bewertet**: Diese Komponente kennt die
 * Lösung nicht — der Server liefert die Interaktion ohne `correct`-Marken, ohne
 * Zielwert und ohne Trefferbereiche, und gibt das Urteil erst als Antwort auf
 * das Absenden zurück.
 *
 * Sie zeigt auch keinen Punktestand. Fortschritt ist die Zahl freigeschalteter
 * Level; eine Punktzahl je Person wäre eine Leistungskennzahl.
 */

export interface InteractionOption {
  index: number
  text: string
}

export interface NativeInteraction {
  id: string
  type: 'choice' | 'estimate' | 'sequence'
  prompt: string
  /** choice */
  options?: InteractionOption[]
  multiple?: boolean
  time_limit_seconds?: number
  /** estimate */
  min?: number
  max?: number
  unit?: string
  /** sequence */
  expected_count?: number
}

export interface InteractionVerdict {
  correct: boolean | null
  feedback: string
  next_content_key: string | null
  unlocked: boolean
}

interface LmsInteractionProps {
  interaction: NativeInteraction
  /** Bereits beantwortet? Dann steht das Ergebnis, nicht das Formular. */
  answered: boolean
  onAnswer: (response: Record<string, unknown>) => Promise<InteractionVerdict>
  labels: {
    submit: string
    submitting: string
    again: string
    answered: string
    correct: string
    incorrect: string
    noted: string
    timeLeft: string
    pickAtLeastOne: string
    foundOf: string
  }
}

export default function LmsInteraction({
  interaction,
  answered,
  onAnswer,
  labels,
}: LmsInteractionProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [value, setValue] = useState<number>(
    interaction.min !== undefined && interaction.max !== undefined
      ? Math.round((interaction.min + interaction.max) / 2)
      : 0,
  )
  const [found, setFound] = useState<string[]>([])
  const [verdict, setVerdict] = useState<InteractionVerdict | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    interaction.time_limit_seconds ?? null,
  )

  // Zeitdruck ist ein Gestaltungsmittel, keine Bewertung: Läuft die Zeit ab,
  // wird abgeschickt, was dasteht — es gibt keine Strafe.
  useEffect(() => {
    if (secondsLeft === null || verdict || answered) return
    if (secondsLeft <= 0) return
    const timer = window.setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, verdict, answered])

  const response = useMemo((): Record<string, unknown> | null => {
    if (interaction.type === 'choice') {
      if (selected.length === 0) return null
      return { selected: interaction.multiple ? selected : selected[0] }
    }
    if (interaction.type === 'estimate') return { value }
    if (interaction.type === 'sequence') {
      if (found.length === 0) return null
      return { found }
    }
    return null
  }, [interaction.type, interaction.multiple, selected, value, found])

  async function submit() {
    if (!response) {
      setError(labels.pickAtLeastOne)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setVerdict(await onAnswer(response))
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? labels.pickAtLeastOne)
    } finally {
      setBusy(false)
    }
  }

  function toggleChoice(index: number) {
    if (interaction.multiple) {
      setSelected((cur) =>
        cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index],
      )
    } else {
      setSelected([index])
    }
  }

  const gesperrt = busy || verdict !== null

  return (
    <div className="interaction">
      <p className="interaction__prompt">{interaction.prompt}</p>

      {secondsLeft !== null && !verdict && (
        <p className="interaction__timer" aria-live="polite">
          {labels.timeLeft}: {Math.max(0, secondsLeft)}s
        </p>
      )}

      {interaction.type === 'choice' && (
        <ul className="interaction__options" role="list">
          {(interaction.options ?? []).map((option) => {
            const aktiv = selected.includes(option.index)
            return (
              <li key={option.index}>
                <button
                  type="button"
                  className={`interaction__option${aktiv ? ' is-selected' : ''}`}
                  aria-pressed={aktiv}
                  disabled={gesperrt}
                  onClick={() => toggleChoice(option.index)}
                >
                  {aktiv ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  <span>{option.text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {interaction.type === 'estimate' && (
        <div className="interaction__estimate">
          <input
            type="range"
            min={interaction.min ?? 0}
            max={interaction.max ?? 100}
            value={value}
            disabled={gesperrt}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label={interaction.prompt}
          />
          <output className="interaction__value">
            {value}
            {interaction.unit ? ` ${interaction.unit}` : ''}
          </output>
        </div>
      )}

      {interaction.type === 'sequence' && (
        <div className="interaction__sequence">
          <p className="interaction__hint">
            {labels.foundOf
              .replace('{found}', String(found.length))
              .replace('{total}', String(interaction.expected_count ?? 0))}
          </p>
          {/*
            Die Trefferbereiche kennt der Server, nicht der Browser. Bis die
            Bildkoordinaten aus dem Manifest ausgeliefert werden, trägt die
            lernende Person ihre Funde als Kennung ein — funktional vollständig,
            optisch schlicht.
          */}
          <input
            type="text"
            placeholder="z. B. absender"
            disabled={gesperrt}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const wert = (e.target as HTMLInputElement).value.trim()
              if (!wert) return
              setFound((cur) => (cur.includes(wert) ? cur : [...cur, wert]))
              ;(e.target as HTMLInputElement).value = ''
            }}
          />
          {found.length > 0 && (
            <ul className="interaction__found" role="list">
              {found.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="interaction__error">{error}</p>}

      {verdict === null ? (
        <button type="button" className="btn btn--primary" disabled={busy} onClick={submit}>
          {busy ? labels.submitting : labels.submit}
        </button>
      ) : (
        <div
          className={`interaction__verdict interaction__verdict--${
            verdict.correct === null ? 'noted' : verdict.correct ? 'correct' : 'incorrect'
          }`}
          role="status"
        >
          <p className="interaction__verdict-title">
            {verdict.correct === null ? (
              <>
                <Info size={18} /> {labels.noted}
              </>
            ) : verdict.correct ? (
              <>
                <CheckCircle2 size={18} /> {labels.correct}
              </>
            ) : (
              <>
                <XCircle size={18} /> {labels.incorrect}
              </>
            )}
          </p>
          {verdict.feedback && <p>{verdict.feedback}</p>}
          {/*
            Erneut versuchen ist erlaubt: Die Interaktion ist ein Lernmittel,
            kein Prüfmittel. Freigeschaltet ist das Level ohnehin schon.
          */}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setVerdict(null)
              setSecondsLeft(interaction.time_limit_seconds ?? null)
            }}
          >
            {labels.again}
          </button>
        </div>
      )}

      {answered && verdict === null && <p className="interaction__hint">{labels.answered}</p>}
    </div>
  )
}
