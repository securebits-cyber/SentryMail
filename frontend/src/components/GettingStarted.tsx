/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ArrowRight, Check, ChevronDown, ChevronRight, Rocket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { api } from '../services/api'

interface Step {
  key: string
  to: string
  done: boolean
}

/**
 * Einstieg zur ersten Kampagne.
 *
 * Bewusst eine **Prüfliste statt einer Anleitung**: Die Schritte melden ihren
 * tatsächlichen Stand zurück, weil eine Anleitung, die nicht weiß, was schon
 * erledigt ist, beim zweiten Besuch nur noch im Weg steht.
 *
 * Sichtbar ausgeklappt, solange es keine Kampagne gibt — danach eingeklappt.
 * Ein leeres Dashboard ohne Hinweis, was zu tun ist, ist der unfreundlichste
 * erste Eindruck, den die Anwendung machen kann.
 */
export default function GettingStarted({ campaigns }: { campaigns: number }) {
  const { t } = useI18n()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [open, setOpen] = useState(campaigns === 0)

  useEffect(() => {
    // Nur zählen, nicht auswerten: Für die Prüfliste genügt „gibt es schon".
    Promise.all([
      api.get<unknown[]>('/templates').catch(() => ({ data: [] })),
      api.get<unknown[]>('/groups').catch(() => ({ data: [] })),
      api.get<unknown[]>('/sending-profiles').catch(() => ({ data: [] })),
    ]).then(([templates, groups, profiles]) => {
      setSteps([
        { key: 'template', to: '/templates?new=1', done: templates.data.length > 0 },
        { key: 'group', to: '/groups?new=1', done: groups.data.length > 0 },
        { key: 'profile', to: '/sending-profiles?new=1', done: profiles.data.length > 0 },
        { key: 'campaign', to: '/campaigns?new=1', done: campaigns > 0 },
      ])
    })
  }, [campaigns])

  useEffect(() => setOpen(campaigns === 0), [campaigns])

  if (!steps) return null

  const remaining = steps.filter((s) => !s.done).length
  if (remaining === 0 && campaigns > 0) return null

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/8 to-transparent">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-text">
          <Rocket size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('start.title')}</span>
          <span className="block text-sm text-text-secondary">
            {remaining === 0 ? t('start.allDone') : t('start.subtitle', { n: String(remaining) })}
          </span>
        </span>
        <span className="shrink-0 text-text-secondary">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
      </button>

      {open && (
        <ol className="flex flex-col gap-px border-t border-accent/20 bg-border/40">
          {steps.map((step, index) => (
            <li key={step.key} className="bg-surface">
              <Link
                to={step.to}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-bg"
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    step.done
                      ? 'bg-status-success/15 text-status-success'
                      : 'bg-sunken text-text-secondary'
                  }`}
                >
                  {step.done ? <Check size={13} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${step.done ? 'text-text-secondary' : ''}`}>
                    {t(`start.step.${step.key}`)}
                  </span>
                  <span className="block text-sm text-text-secondary">
                    {t(`start.step.${step.key}.hint`)}
                  </span>
                </span>
                {!step.done && <ArrowRight size={15} className="mt-1 shrink-0 text-accent" />}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
