import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/** Einheitlicher Seiten-Header mit Titel, optionaler Aktion und Akzent-Linie. */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {/* Durchgehende Trennlinie mit farbigem Akzent-Segment am linken Rand. */}
      <div className="mt-3 h-0.5 w-full bg-border">
        <div className="h-0.5 w-24 rounded-full bg-accent" />
      </div>
    </header>
  )
}
