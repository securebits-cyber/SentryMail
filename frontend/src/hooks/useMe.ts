/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { User } from '../types'

/** Laedt den aktuell angemeldeten Nutzer (/me), z. B. fuer rollenbasierte UI. */
export function useMe() {
  const [me, setMe] = useState<User | null>(null)

  useEffect(() => {
    api
      .get<User>('/me')
      .then((res) => setMe(res.data))
      .catch(() => setMe(null))
  }, [])

  return me
}
