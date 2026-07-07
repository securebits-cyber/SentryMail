/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { mdToHtml } from '../utils/markdown'

interface Props {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}

/** Zweigeteilter Markdown-Editor: Eingabe links, Live-HTML-Vorschau rechts. */
export default function MarkdownEditor({ value, onChange, rows = 14, placeholder }: Props) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder ?? '# Überschrift\n\nHallo **{{ first_name }}**,\n\n[Jetzt anmelden]({{ link }})'}
        className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-text-primary"
      />
      {/* Vorschau in einem sandboxed iframe (kein allow-scripts): der gerenderte
          HTML-Inhalt kann so kein Script/onerror in der Dashboard-Origin ausführen
          (verhindert Stored-XSS über geteilte Vorlagen). */}
      <iframe
        title="Preview"
        srcDoc={mdToHtml(value)}
        sandbox=""
        className="h-[420px] w-full rounded-md border border-border bg-white"
      />
    </div>
  )
}
