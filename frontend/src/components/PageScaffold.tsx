/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { BookOpen, ChevronRight, type LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { pageGuidance } from './pageGuidance'

interface BreadcrumbItem {
  label: string
  icon?: LucideIcon
}

interface PageScaffoldProps {
  title: string
  subtitle?: string
  /** Optionale Mono-Overline (ALL-CAPS, Ember) ueber dem Titel. */
  eyebrow?: string
  actions?: ReactNode
  breadcrumb?: BreadcrumbItem[]
  /** Schlüssel in pageGuidance; ohne ihn erscheint kein Anleitungs-Bereich. */
  guidanceKey?: string
  children: ReactNode
}

// Feste Breite des Anleitungs-Bereichs; ab xl sichtbar, sonst ausgeblendet.
const helpCol = 'hidden w-96 shrink-0 border-l border-border xl:block'

/**
 * Einheitliches Seitengerüst (Netbird-Stil): Titel links, Anleitungs-Kopf rechts,
 * darunter eine durchgehende horizontale Trennlinie über die volle Breite, dann
 * Inhalt links und die nummerierten Anleitungs-Schritte rechts.
 */
export default function PageScaffold({ title, subtitle, eyebrow, actions, breadcrumb, guidanceKey, children }: PageScaffoldProps) {
  const { t, lang } = useI18n()
  const guidance = guidanceKey ? pageGuidance[lang][guidanceKey] : undefined

  return (
    <div className="-m-6 flex min-h-full flex-col">
      {/* Kopfbereich (nur Titel). Rechts ein rahmenloser Platzhalter in Breite des
          Anleitungs-Bereichs, damit die Trennlinie darunter voll durchläuft, ohne
          dass die senkrechte Linie sie kreuzt. */}
      <div className="flex">
        <div className="flex-1 px-6 pt-6 pb-4">
          {breadcrumb && (
            <div className="mb-2 flex items-center gap-1.5 text-sm text-text-secondary">
              {breadcrumb.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight size={13} className="opacity-60" />}
                  {item.icon && <item.icon size={14} />}
                  {item.label}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end justify-between gap-4">
            <div>
              {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </div>
        {guidance && <div className="hidden w-96 shrink-0 xl:block" aria-hidden />}
      </div>

      {/* Durchgehende horizontale Trennlinie mit Akzent-Segment am linken Rand. */}
      <div className="relative h-px w-full bg-border">
        <div className="absolute left-6 top-1/2 h-0.5 w-24 -translate-y-1/2 rounded-full bg-accent" />
      </div>

      {/* Inhalt links, kompletter Anleitungs-Bereich rechts — beides unterhalb der
          Linie. Die senkrechte Linie beginnt erst hier (T-Stoß statt Kreuz). */}
      <div className="flex flex-1">
        <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
        {guidance && (
          <aside className={`${helpCol} px-6 py-6`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen size={15} />
              {t('guide.title')}
            </div>
            <p className="mt-2 text-sm text-text-secondary">{guidance.intro}</p>
            <ol className="mt-4 flex flex-col gap-3">
              {guidance.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-secondary">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-medium text-accent-text">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {guidance.variables && (
              <div className="mt-5">
                <div className="text-xs font-medium uppercase tracking-wider text-text-secondary">{t('guide.variables')}</div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {guidance.variables.map((v) => (
                    <li key={v.name} className="text-sm text-text-secondary">
                      <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-xs text-accent-text">{v.name}</code>
                      <span className="ml-2">{v.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(guidance.tier || guidance.note) && (
              <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
                {guidance.tier && (
                  <span className={`font-semibold ${guidance.tier === 'business' ? 'text-green-600' : 'text-blue-600'}`}>
                    {t(guidance.tier === 'business' ? 'guide.businessFeature' : 'guide.enterpriseFeature')}
                  </span>
                )}
                {guidance.tier && guidance.note ? '. ' : ''}
                {guidance.note}
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
