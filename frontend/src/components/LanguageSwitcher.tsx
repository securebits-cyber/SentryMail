/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useI18n } from '../i18n'
import type { Lang } from '../i18n/translations'

const langs: Lang[] = ['de', 'en']

/** Kompakter DE/EN-Umschalter (Auswahl wird in localStorage gemerkt). */
export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
      role="group"
      aria-label="Sprache / Language"
    >
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded px-2 py-1 text-xs font-medium ${
            lang === l ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
