/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { VersionResponse } from '../types'

/** Laedt die laufende Version + Update-Status (/version). Backend ist die
 *  Single Source of Truth, damit sich die Anzeige nach jedem Deploy von selbst
 *  aktualisiert und einen Hinweis auf neue Releases zeigen kann. */
export function useVersion() {
  const [version, setVersion] = useState<VersionResponse | null>(null)

  useEffect(() => {
    api
      .get<VersionResponse>('/version')
      .then((res) => setVersion(res.data))
      .catch(() => setVersion(null))
  }, [])

  return version
}
