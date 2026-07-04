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
