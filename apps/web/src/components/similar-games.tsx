/** "Parecidos com este" on the game page: games close to this one in small cards, six a page, its
 * expansions, base game and series first with a tag. */
import { useEffect, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { SimilarGame, SimilarRelation } from '../lib/types'
import { GameCard, GameShelf } from './game-band'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Parecidos com este',
    expansion: 'Expansão',
    base: 'Jogo base',
    series: 'Mesma série',
  },
  [Language.En]: {
    title: 'Similar to this one',
    expansion: 'Expansion',
    base: 'Base game',
    series: 'Same series',
  },
})

export type SimilarGamesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; items: SimilarGame[] }

const ORDER: Record<SimilarRelation, number> = { expansion: 0, base: 1, series: 2, similar: 3 }

/** The section for a load state; nothing when there is no game to show or the request failed. */
export function SimilarGames({ state }: { state: SimilarGamesState }) {
  const t = useMessages(messages)
  if (state.status === 'error') return null
  const items = state.status === 'ok' ? state.items : []
  const cards = [...items]
    .sort((a, b) => ORDER[a.relation] - ORDER[b.relation])
    .map((s) => (
      <GameCard
        key={s.game.id}
        item={{
          game: s.game,
          difficulty: s.difficulty,
          hours: s.hours,
          tag: s.relation === 'similar' ? undefined : t(s.relation),
        }}
      />
    ))
  return (
    <GameShelf
      id="similar-games-title"
      title={t('title')}
      size="compact"
      loading={state.status === 'loading'}
      cards={cards}
    />
  )
}

/** Fetches the similar games of `gameId` once per game (kept in the app cache) and shows them. */
export function SimilarGamesSection({ gameId }: { gameId: string }) {
  const { cache } = useApp()
  const key = `similar-games:${gameId}`
  const [state, setState] = useState<SimilarGamesState>(() => {
    const items = cache[key] as SimilarGame[] | undefined
    return items ? { status: 'ok', items } : { status: 'loading' }
  })
  useEffect(() => {
    const seen = cache[key] as SimilarGame[] | undefined
    if (seen) {
      setState({ status: 'ok', items: seen })
      return
    }
    let live = true
    setState({ status: 'loading' })
    api<{ items: SimilarGame[] }>(`/api/games/similar?game=${encodeURIComponent(gameId)}`)
      .then(({ items }) => {
        cache[key] = items
        if (live) setState({ status: 'ok', items })
      })
      .catch(() => {
        if (live) setState({ status: 'error' })
      })
    return () => {
      live = false
    }
  }, [cache, key, gameId])
  return <SimilarGames key={gameId} state={state} />
}
