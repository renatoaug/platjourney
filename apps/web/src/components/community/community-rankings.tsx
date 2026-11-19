import { useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { type Board, playerLink, type Rankings, type RankRow } from '../../lib/community'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { EmptyState, ErrorState } from '../../ui/states'
import { Avatar } from './community-feed'
import './community-feed.css'
import './community-rankings.css'

const messages = defineMessages({
  [Language.PtBR]: {
    periods: 'Período',
    month: 'Este mês',
    year: 'Este ano',
    boards: 'Leaderboard',
    platinums: 'Platinas',
    rare: 'Troféus raros',
    fastest: 'Mais rápida',
    platinumCount: { one: '{count} platina', other: '{count} platinas' },
    rareCount: { one: '{count} raro', other: '{count} raros' },
    days: { one: '{count} dia', other: '{count} dias' },
    under: 'menos de 1 dia',
    yourPlace: 'Sua posição',
    notRanked: 'Você ainda não pontuou neste período.',
    empty: 'Ninguém pontuou neste período ainda.',
    failed: 'Não foi possível carregar o leaderboard.',
    retry: 'Tentar de novo',
  },
  [Language.En]: {
    periods: 'Period',
    month: 'This month',
    year: 'This year',
    boards: 'Leaderboard',
    platinums: 'Platinums',
    rare: 'Rare trophies',
    fastest: 'Fastest',
    platinumCount: { one: '{count} platinum', other: '{count} platinums' },
    rareCount: { one: '{count} rare', other: '{count} rare' },
    days: { one: '{count} day', other: '{count} days' },
    under: 'under 1 day',
    yourPlace: 'Your place',
    notRanked: 'You have not scored in this period yet.',
    empty: 'Nobody has scored in this period yet.',
    failed: 'Could not load the leaderboard.',
    retry: 'Try again',
  },
})

const BOARDS: Board[] = ['platinums', 'rare', 'fastest']

export type RankingsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; data: Rankings }

/** One board at a time, picked by tabs: a podium for the top three, a list after them and the
 * reader's own place pinned at the foot. */
export function CommunityRankings({
  state,
  period,
  onPeriod,
  onRetry,
  initialBoard = 'platinums',
}: {
  state: RankingsState
  period: 'month' | 'year'
  onPeriod: (period: 'month' | 'year') => void
  onRetry: () => void
  initialBoard?: Board
}) {
  const t = useMessages(messages)
  const [board, setBoard] = useState<Board>(initialBoard)
  return (
    <section className="community-rankings" aria-label={t('boards')}>
      <div className="community-rankings-bar">
        <fieldset className="community-board-tabs" aria-label={t('boards')}>
          {BOARDS.map((b) => (
            <button key={b} type="button" aria-pressed={board === b} onClick={() => setBoard(b)}>
              {t(b)}
            </button>
          ))}
        </fieldset>
        {/* The period as one quiet toggle: tap to switch between this month and this year. */}
        <button
          type="button"
          className="community-period"
          aria-label={t('periods')}
          onClick={() => onPeriod(period === 'month' ? 'year' : 'month')}
        >
          {t(period)} <Icon name="swap" />
        </button>
      </div>
      {state.status === 'loading' ? (
        <BoardSkeleton />
      ) : state.status === 'error' ? (
        <ErrorState
          action={
            <button type="button" className="button" onClick={onRetry}>
              {t('retry')}
            </button>
          }
        >
          {t('failed')}
        </ErrorState>
      ) : (
        <BoardView data={state.data} board={board} />
      )}
    </section>
  )
}

function scoreOf(t: ReturnType<typeof useMessages<typeof messages>>, board: Board, r: RankRow) {
  if (board === 'platinums') return t('platinumCount', { count: r.value })
  if (board === 'rare') return t('rareCount', { count: r.value })
  return r.value < 1 ? t('under') : t('days', { count: Math.round(r.value) })
}

function Name({ data, user }: { data: Rankings; user: string }) {
  const p = data.people[user]
  return p ? (
    <Link className="community-rank-name" to={playerLink(p.onlineId)}>
      @{p.onlineId}
    </Link>
  ) : (
    <span className="community-rank-name">—</span>
  )
}

// The podium in its order on screen: second, first, third.
const PODIUM = [1, 0, 2]

function BoardView({ data, board }: { data: Rankings; board: Board }) {
  const t = useMessages(messages)
  const rows = data[board]
  const mine = data.mine?.[board] ?? null
  if (!rows.length) return <EmptyState icon="trophy">{t('empty')}</EmptyState>
  const rest = rows.slice(3, 20)
  return (
    <div className={`card community-board is-${board}`}>
      <ol className="community-podium">
        {PODIUM.filter((i) => rows[i]).map((i) => {
          const r = rows[i]
          return (
            <li key={r.user} className={`community-podium-step place-${i + 1}`} value={i + 1}>
              <span className="community-podium-face">
                {i === 0 && (
                  <span className="community-podium-crown" aria-hidden="true">
                    <Icon name="crown" />
                  </span>
                )}
                <Avatar person={data.people[r.user]} link />
                <span className="community-podium-place">{i + 1}</span>
              </span>
              <Name data={data} user={r.user} />
              <b className="community-rank-value">{scoreOf(t, board, r)}</b>
              {board === 'fastest' && r.game && (
                <small className="community-rank-game">{r.game.name}</small>
              )}
            </li>
          )
        })}
      </ol>
      {rest.length > 0 && (
        <ol className="community-rank-list" start={4}>
          {rest.map((r, i) => (
            <li key={r.user} className={r.user === data.me ? 'mine' : undefined}>
              <span className="community-rank-pos">{i + 4}</span>
              <Avatar person={data.people[r.user]} link />
              <span className="community-rank-who">
                <Name data={data} user={r.user} />
                {board === 'fastest' && r.game && (
                  <small className="community-rank-game">{r.game.name}</small>
                )}
              </span>
              <b className="community-rank-value">{scoreOf(t, board, r)}</b>
            </li>
          ))}
        </ol>
      )}
      {/* The reader's own place, pinned at the foot of the board. */}
      <div className={`community-rank-mine${mine ? '' : ' none'}`}>
        {mine ? (
          <>
            <span className="community-rank-pos">{mine.place}</span>
            <Avatar person={data.people[data.me]} />
            <span className="community-rank-who">{t('yourPlace')}</span>
            <b className="community-rank-value">{scoreOf(t, board, mine)}</b>
          </>
        ) : (
          <span className="community-rank-who">{t('notRanked')}</span>
        )}
      </div>
    </div>
  )
}

function BoardSkeleton() {
  // The podium's own shapes (round faces, the first raised) and the reader's row at the foot.
  return (
    <div className="card community-board" aria-hidden="true">
      <div className="community-podium">
        {[1, 2, 3].map((place) => (
          <div key={place} className={`community-podium-step place-${place}`}>
            <span className="community-podium-face">
              <span className="community-avatar">
                <Sk w="100%" style={{ height: '100%' }} />
              </span>
            </span>
            <Sk w={80} h={12} />
            <Sk w={56} h={12} />
          </div>
        ))}
      </div>
      <div className="community-rank-list">
        {repeat(3, () => (
          <Sk w="100%" h={44} />
        ))}
      </div>
      <div className="community-rank-mine none">
        <Sk w="60%" h={14} />
      </div>
    </div>
  )
}
