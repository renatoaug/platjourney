import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { type CommunityGames as Games, gameLink } from '../../lib/community'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { EmptyState, ErrorState } from '../../ui/states'
import './community-games.css'

const messages = defineMessages({
  [Language.PtBR]: {
    playing: 'Sendo jogados agora',
    playingLead: 'Com troféus nos últimos 7 dias',
    platinumed: 'Mais platinados no mês',
    wanted: 'Mais desejados',
    wantedLead: 'Nos interesses de mais jogadores',
    players: { one: '{count} jogador', other: '{count} jogadores' },
    empty: 'Nada por aqui ainda.',
    failed: 'Não foi possível carregar os jogos da comunidade.',
    retry: 'Tentar de novo',
  },
  [Language.En]: {
    playing: 'Being played now',
    playingLead: 'With trophies in the last 7 days',
    platinumed: 'Most platinumed this month',
    wanted: 'Most wanted',
    wantedLead: 'In the most players’ interests',
    players: { one: '{count} player', other: '{count} players' },
    empty: 'Nothing here yet.',
    failed: 'Could not load the community’s games.',
    retry: 'Try again',
  },
})

export type GamesState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: Games }

interface Row {
  key: string
  name: string
  art: string | null
  link: string | null
  players: number
}

export function CommunityGames({ state, onRetry }: { state: GamesState; onRetry: () => void }) {
  const t = useMessages(messages)
  if (state.status === 'error')
    return (
      <ErrorState
        action={
          <button type="button" className="button" onClick={onRetry}>
            {t('retry')}
          </button>
        }
      >
        {t('failed')}
      </ErrorState>
    )
  if (state.status === 'loading')
    return (
      <div className="community-shelves" aria-hidden="true">
        {repeat(3, () => (
          <div className="community-shelf">
            <Sk w="30%" h={20} />
            <div className="community-shelf-list">
              {repeat(5, () => (
                <span className="community-shelf-tile">
                  <span className="community-shelf-art">
                    <Sk w="100%" style={{ height: '100%' }} />
                  </span>
                  <Sk w="80%" h={12} />
                  <Sk w="50%" h={10} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  const { playing, platinumed, wanted } = state.data
  const fromCount = (rows: typeof playing): Row[] =>
    rows.map((r) => ({
      key: r.game.np,
      name: r.game.name,
      art: r.game.coverUrl ?? r.game.iconUrl,
      link: gameLink(r.game),
      players: r.players,
    }))
  return (
    <div className="community-shelves">
      <Shelf title={t('playing')} lead={t('playingLead')} rows={fromCount(playing)} />
      <Shelf title={t('platinumed')} rows={fromCount(platinumed)} />
      <Shelf
        title={t('wanted')}
        lead={t('wantedLead')}
        rows={wanted.map((w) => ({
          key: w.game,
          name: w.name,
          art: w.coverUrl,
          link: gameLink({ np: '', name: w.name, iconUrl: null, id: w.game }),
          players: w.players,
        }))}
      />
    </div>
  )
}

function Shelf({ title, lead, rows }: { title: string; lead?: string; rows: Row[] }) {
  const t = useMessages(messages)
  return (
    <section className="community-shelf" aria-label={title}>
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </header>
      {!rows.length ? (
        <EmptyState icon="gamepad">{t('empty')}</EmptyState>
      ) : (
        <ol className="community-shelf-list">
          {rows.map((r, i) => {
            const body = (
              <>
                <span className="community-shelf-art">
                  <Cover url={r.art} name={r.name} />
                  <span className="community-shelf-rank">{String(i + 1).padStart(2, '0')}</span>
                </span>
                <span className="community-shelf-name">{r.name}</span>
                <span className="community-shelf-players">
                  <Icon name="users" /> {t('players', { count: r.players })}
                </span>
              </>
            )
            return (
              <li key={r.key}>
                {r.link ? (
                  <Link to={r.link} className="community-shelf-tile">
                    {body}
                  </Link>
                ) : (
                  <span className="community-shelf-tile">{body}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
