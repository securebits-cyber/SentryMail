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
      <div
        className="max-h-[420px] min-h-[8rem] overflow-auto rounded-md border border-border bg-white p-3 text-sm text-black"
        // Vorschau des vom Admin verfassten Markdown-Inhalts.
        dangerouslySetInnerHTML={{ __html: mdToHtml(value) }}
      />
    </div>
  )
}
