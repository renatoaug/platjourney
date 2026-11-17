/** Beside the feed on a wide screen: the month's top platinum hunters and the games being played
 * now, each with a link to its full tab. A thin container fetches; the view takes the data. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import {
  type CommunityGames,
  fetchCommunityGames,
  fetchRankings,
  gameLink,
  playerLink,
  type Rankings,
} from '../../lib/community'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { TrophyMedal } from '../../ui/trophy-medal'
import { Avatar } from './community-feed'
import './community-side.css'

const messages = defineMessages({
  [Language.PtBR]: {
    top: 'Top platinas do mês',
    playing: 'Em alta agora',
    seeRankings: 'Ver rankings',
    seeGames: 'Ver jogos',
    platinums: { one: '{count} platina', other: '{count} platinas' },
    players: { one: '{count} jogador', other: '{count} jogadores' },
    emptyTop: 'Ninguém platinou este mês ainda.',
    emptyPlaying: 'Nenhum jogo com troféus esta semana.',
  },
  [Language.En]: {
    top: 'Top platinums this month',
    playing: 'Trending now',
    seeRankings: 'See rankings',
    seeGames: 'See games',
    platinums: { one: '{count} platinum', other: '{count} platinums' },
    players: { one: '{count} player', other: '{count} players' },
    emptyTop: 'Nobody has platinumed this month yet.',
    emptyPlaying: 'No game with trophies this week.',
  },
})

export type SideState =
  | { status: 'loading' }
  | { status: 'ok'; rankings: Rankings | null; games: CommunityGames | null }

export function CommunitySide({ onTab }: { onTab: (tab: 'rankings' | 'games') => void }) {
  const [state, setState] = useState<SideState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    // Each part on its own: one that fails leaves the other standing.
    Promise.all([
      fetchRankings('month').catch(() => null),
      fetchCommunityGames().catch(() => null),
    ]).then(([rankings, games]) => live && setState({ status: 'ok', rankings, games }))
    return () => {
      live = false
    }
  }, [])
  return <CommunitySideView state={state} onTab={onTab} />
}

export function CommunitySideView({
  state,
  onTab,
}: {
  state: SideState
  onTab: (tab: 'rankings' | 'games') => void
}) {
  const t = useMessages(messages)
  if (state.status === 'loading')
    return (
      <aside className="community-side" aria-hidden="true">
        {repeat(2, () => (
          <div className="card community-side-card">
            <Sk w="60%" h={18} />
            <div className="community-side-list">
              {repeat(3, () => (
                <span className="community-side-game">
                  <span className="community-side-cover">
                    <Sk w="100%" style={{ height: '100%' }} />
                  </span>
                  <Sk w="60%" h={12} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </aside>
    )
  const top = state.rankings?.platinums.slice(0, 3) ?? []
  const playing = state.games?.playing.slice(0, 4) ?? []
  return (
    <aside className="community-side">
      {state.rankings && (
        <section className="card community-side-card" aria-labelledby="community-side-top">
          <h2 id="community-side-top">
            <TrophyMedal type="platinum" /> {t('top')}
          </h2>
          {top.length ? (
            <ol className="community-side-list">
              {top.map((r, i) => {
                const p = state.rankings?.people[r.user]
                return (
                  <li key={r.user}>
                    <span className={`community-side-pos place-${i + 1}`}>{i + 1}</span>
                    <Avatar person={p} />
                    {p ? (
                      <Link className="community-side-name" to={playerLink(p.onlineId)}>
                        @{p.onlineId}
                      </Link>
                    ) : (
                      <span className="community-side-name">—</span>
                    )}
                    <b>{t('platinums', { count: r.value })}</b>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="community-side-empty">{t('emptyTop')}</p>
          )}
          <button type="button" className="text-link" onClick={() => onTab('rankings')}>
            {t('seeRankings')} <Icon name="arrow" />
          </button>
        </section>
      )}
      {state.games && (
        <section className="card community-side-card" aria-labelledby="community-side-playing">
          <h2 id="community-side-playing">
            <Icon name="gamepad" /> {t('playing')}
          </h2>
          {playing.length ? (
            <ol className="community-side-list">
              {playing.map((g) => {
                const link = gameLink(g.game)
                const body = (
                  <>
                    <Cover
                      className="community-side-cover"
                      url={g.game.coverUrl ?? g.game.iconUrl}
                      name={g.game.name}
                    />
                    <span className="community-side-name">{g.game.name}</span>
                    <b>{t('players', { count: g.players })}</b>
                  </>
                )
                return (
                  <li key={g.game.np}>
                    {link ? (
                      <Link className="community-side-game" to={link}>
                        {body}
                      </Link>
                    ) : (
                      <span className="community-side-game">{body}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="community-side-empty">{t('emptyPlaying')}</p>
          )}
          <button type="button" className="text-link" onClick={() => onTab('games')}>
            {t('seeGames')} <Icon name="arrow" />
          </button>
        </section>
      )}
    </aside>
  )
}
