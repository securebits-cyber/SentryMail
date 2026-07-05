/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { marked } from 'marked'

/**
 * Wandelt Markdown in HTML um (für Vorlagen- und Landing-Page-Inhalte).
 * Autoren sind Admins/Redakteure der eigenen Instanz — kein Fremd-Input.
 *
 * Vorlagen-Variablen wie {{ link }} enthalten Leerzeichen und würden die
 * Markdown-Link-Syntax brechen ([text]({{ link }})). Sie werden daher vor der
 * Umwandlung durch neutrale Platzhalter ersetzt und danach wiederhergestellt.
 */
export function mdToHtml(md: string): string {
  const tokens: string[] = []
  const guarded = (md ?? '').replace(/\{\{.*?\}\}/g, (match) => {
    const i = tokens.push(match) - 1
    return `MDVAR${i}ENDVAR`
  })
  let html = marked.parse(guarded, { async: false, breaks: true, gfm: true }) as string
  html = html.replace(/MDVAR(\d+)ENDVAR/g, (_, i) => tokens[Number(i)] ?? '')
  return html
}
