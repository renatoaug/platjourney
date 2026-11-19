/** /api/profile for the screens that show the player's platinums outside the profile: fetched once and kept in the app cache the profile screen also reads. */
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ProfileData } from '../pages/profile'
import { useApp } from './app-state'

export function useProfile(wanted = true): ProfileData | null {
  const { cache, me } = useApp()
  // Someone without an account has no profile of their own to fetch.
  const enabled = wanted && !me.visitor
  const [data, setData] = useState(() => (cache.profile as ProfileData | undefined) ?? null)
  useEffect(() => {
    if (!enabled) return
    // Opened after the profile screen filled the cache: use it, the state started before that.
    if (cache.profile) {
      setData(cache.profile as ProfileData)
      return
    }
    let live = true
    api<ProfileData>('/api/profile')
      .then((d) => {
        cache.profile = d
        if (live) setData(d)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [enabled, cache])
  return data
}
