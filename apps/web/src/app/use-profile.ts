/** /api/profile for the screens that show the player's platinums outside the profile: fetched once and kept in the app cache the profile screen also reads. */
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ProfileData } from '../pages/profile'
import { useApp } from './app-state'

export function useProfile(enabled = true): ProfileData | null {
  const { cache } = useApp()
  const [data, setData] = useState(() => (cache.profile as ProfileData | undefined) ?? null)
  useEffect(() => {
    if (!enabled || cache.profile) return
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
