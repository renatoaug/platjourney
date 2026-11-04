import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { api } from './api'

/** Server-owned preference: no browser-local copy can leak across signed-in accounts. */
export function useGameSpoilers(game: string) {
  const { me, setMe } = useApp()
  const current = useRef({ me, game })
  current.current = { me, game }
  const mounted = useRef(true)
  const busy = useRef(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const setRevealed = async (revealed: boolean) => {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    const owner = me.id
    try {
      const result = await api<{ revealedTrophyGames: string[] }>(
        '/api/account/trophy-visibility',
        { game, revealed, owner },
      )
      if (mounted.current && current.current.me.id === owner)
        setMe({ ...current.current.me, revealedTrophyGames: result.revealedTrophyGames })
    } finally {
      busy.current = false
      if (mounted.current) setSaving(false)
    }
  }
  return { revealed: me.revealedTrophyGames?.includes(game) ?? false, setRevealed, saving }
}
