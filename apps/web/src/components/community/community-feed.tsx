import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import {
  type CommunityEvent,
  type FeedScope,
  gameLink,
  type MedalKind,
  type Person,
  playerLink,
  type ReactionKind,
  rarityTier,
} from '../../lib/community'
import { fmtAgo, fmtRate } from '../../lib/format'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { EmptyState, ErrorState } from '../../ui/states'
import { TrophyMedal } from '../../ui/trophy-medal'
import { CommunityReactions } from './community-reactions'
import './community-feed.css'

const messages = defineMessages({
  [Language.PtBR]: {
    feed: 'Feed da comunidade',
    scopes: 'Mostrar',
    all: 'Todos',
    following: 'Quem eu sigo',
    me: 'Eu',
    platinum: 'Platinou',
    rare: 'Troféu raro',
    start: 'Começou a caçada',
    medal: 'Nova medalha',
    inGame: 'em {game}',
    ultra: 'Ultra raro · {rate}%',
    very: 'Muito raro · {rate}%',
    rareTier: 'Raro · {rate}%',
    common: 'Comum · {rate}%',
    follow: 'Seguir',
    unfollow: 'Seguindo',
    followLabel: 'Seguir {name}',
    unfollowLabel: 'Deixar de seguir {name}',
    more: 'Ver mais',
    loadingMore: 'Carregando…',
    emptyAll:
      'Ainda não tem nada por aqui. Assim que alguém pegar um troféu raro ou uma platina, aparece no feed.',
    emptyFollowing:
      'Você ainda não segue ninguém. Toque em Seguir em alguém do feed para ver só essa turma aqui.',
    emptyMe: 'Suas platinas, troféus raros e medalhas dos últimos 30 dias aparecem aqui.',
    hidden:
      'Você está fora da Comunidade: os outros não veem o que você conquista. Dá para mudar em Configurações.',
    failed: 'Não foi possível carregar o feed.',
    retry: 'Tentar de novo',
    rare_hunter: 'Caçador de raros',
    quick_platinum: 'Platina relâmpago',
    no_day_off: 'Sem folga',
    year_goal: 'Meta do ano',
  },
  [Language.En]: {
    feed: 'Community feed',
    scopes: 'Show',
    all: 'Everyone',
    following: 'Following',
    me: 'Me',
    platinum: 'Platinumed',
    rare: 'Rare trophy',
    start: 'Started the hunt',
    medal: 'New medal',
    inGame: 'in {game}',
    ultra: 'Ultra rare · {rate}%',
    very: 'Very rare · {rate}%',
    rareTier: 'Rare · {rate}%',
    common: 'Common · {rate}%',
    follow: 'Follow',
    unfollow: 'Following',
    followLabel: 'Follow {name}',
    unfollowLabel: 'Unfollow {name}',
    more: 'Show more',
    loadingMore: 'Loading…',
    emptyAll:
      'Nothing here yet. As soon as someone earns a rare trophy or a platinum, it shows up in the feed.',
    emptyFollowing:
      'You are not following anyone yet. Tap Follow on someone in the feed to see just them here.',
    emptyMe: 'Your platinums, rare trophies and medals from the last 30 days show up here.',
    hidden:
      'You are out of the Community: others do not see what you earn. You can change it in Settings.',
    failed: 'Could not load the feed.',
    retry: 'Try again',
    rare_hunter: 'Rare hunter',
    quick_platinum: 'Lightning platinum',
    no_day_off: 'No day off',
    year_goal: 'Year goal',
  },
})

const MEDAL_ICON: Record<MedalKind, string> = {
  rare_hunter: '💎',
  quick_platinum: '⚡',
  no_day_off: '📅',
  year_goal: '🎯',
}

export type FeedState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ok'
      events: CommunityEvent[]
      people: Record<string, Person>
      following: string[]
      next: string | null
      visible: boolean
      loadingMore?: boolean
    }

export function CommunityFeed({
  state,
  scope,
  onScope,
  onRetry,
  toolbar,
  ...rest
}: {
  state: FeedState
  scope: FeedScope
  onScope: (scope: FeedScope) => void
  /** Beside the filters: the player's own switch to show up in the community. */
  toolbar?: ReactNode
  onReact: (event: CommunityEvent, kind: ReactionKind) => void
  onFollow: (user: string, on: boolean) => void
  onMore: () => void
  onRetry: () => void
  me: string
  /** Rare trophies show their English name when the page is in English. */
  english?: boolean
  /** The demo looks without taking part: no reactions or follows. */
  readOnly?: boolean
}) {
  const t = useMessages(messages)
  return (
    <section className="community-feed" aria-label={t('feed')}>
      <div className="community-feed-bar">
        <fieldset className="chips community-scopes" aria-label={t('scopes')}>
          {(['all', 'following', 'me'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${scope === s ? ' active' : ''}`}
              aria-pressed={scope === s}
              onClick={() => onScope(s)}
            >
              {t(s)}
            </button>
          ))}
        </fieldset>
        {toolbar}
      </div>
      {state.status === 'ok' && !state.visible && <p className="community-hidden">{t('hidden')}</p>}
      {state.status === 'loading' && <FeedSkeleton />}
      {state.status === 'error' && (
        <ErrorState
          action={
            <button type="button" className="button" onClick={onRetry}>
              {t('retry')}
            </button>
          }
        >
          {t('failed')}
        </ErrorState>
      )}
      {state.status === 'ok' && <FeedList state={state} scope={scope} {...rest} />}
    </section>
  )
}

const EMPTY: Record<FeedScope, 'emptyAll' | 'emptyFollowing' | 'emptyMe'> = {
  all: 'emptyAll',
  following: 'emptyFollowing',
  me: 'emptyMe',
}

function FeedList({
  state,
  scope,
  onReact,
  onFollow,
  onMore,
  me,
  english = false,
  readOnly = false,
}: {
  state: Extract<FeedState, { status: 'ok' }>
  scope: FeedScope
  onReact: (event: CommunityEvent, kind: ReactionKind) => void
  onFollow: (user: string, on: boolean) => void
  onMore: () => void
  me: string
  english?: boolean
  readOnly?: boolean
}) {
  const t = useMessages(messages)
  if (!state.events.length) return <EmptyState icon="users">{t(EMPTY[scope])}</EmptyState>
  return (
    <>
      <CommunityEventList
        events={state.events}
        people={state.people}
        following={state.following}
        me={me}
        english={english}
        readOnly={readOnly}
        onReact={onReact}
        onFollow={onFollow}
      />
      {state.next && (
        <button
          type="button"
          className="button ghost community-more"
          onClick={onMore}
          disabled={state.loadingMore}
        >
          {state.loadingMore ? t('loadingMore') : t('more')}
        </button>
      )}
    </>
  )
}

/** Events as cards, the same in the feed and on a player's page. */
function CommunityEventList({
  events,
  people,
  following,
  me,
  english = false,
  readOnly = false,
  onReact,
  onFollow,
}: {
  events: CommunityEvent[]
  people: Record<string, Person>
  following: string[]
  me: string
  english?: boolean
  readOnly?: boolean
  onReact: (event: CommunityEvent, kind: ReactionKind) => void
  onFollow: (user: string, on: boolean) => void
}) {
  return (
    <ol className="community-events">
      {events.map((e) => (
        <FeedItem
          key={e.key}
          event={e}
          person={people[e.user]}
          followed={following.includes(e.user)}
          mine={e.user === me}
          english={english}
          readOnly={readOnly}
          onReact={(kind) => onReact(e, kind)}
          onFollow={(on) => onFollow(e.user, on)}
        />
      ))}
    </ol>
  )
}

const TIER_KEY = { ultra: 'ultra', very: 'very', rare: 'rareTier', common: 'common' } as const

/** The share of players who have it, in PSN's tiers: "Ultra raro · 3,3%". */
function Rate({ rate }: { rate: number }) {
  const t = useMessages(messages)
  if (!(rate > 0)) return null
  const tier = rarityTier(rate)
  return (
    <span className={`community-rate is-${tier}`}>
      {t(TIER_KEY[tier], { rate: fmtRate(rate) })}
    </span>
  )
}

/** The badge on the left of what happened: the trophy itself, or the medal. */
function EventBadge({ event: e }: { event: CommunityEvent }) {
  if (e.kind === 'medal')
    return (
      <span className="community-event-badge medal" aria-hidden="true">
        {MEDAL_ICON[e.medal]}
      </span>
    )
  if (e.kind === 'start')
    return (
      <span className="community-event-badge start" aria-hidden="true">
        <Icon name="gamepad" />
      </span>
    )
  return (
    <span className="community-event-badge" aria-hidden="true">
      <TrophyMedal type={e.kind === 'platinum' ? 'platinum' : (e.type ?? 'gold')} />
    </span>
  )
}

/** What happened: a small kicker ("Platinou") over the big name (the game, the trophy, the medal). */
function EventWhat({ event: e, english }: { event: CommunityEvent; english: boolean }) {
  const t = useMessages(messages)
  const link = gameLink(e.game)
  const game = !e.game ? null : link ? <Link to={link}>{e.game.name}</Link> : e.game.name
  const title =
    e.kind === 'medal'
      ? t(e.medal)
      : e.kind === 'rare'
        ? english
          ? e.trophyEn || e.trophy
          : e.trophy
        : game
  return (
    <div className="community-event-what">
      <EventBadge event={e} />
      <div className="community-event-text">
        <span className="community-event-kicker">{t(e.kind)}</span>
        <strong className="community-event-title">{title}</strong>
        {e.kind === 'rare' && e.game && (
          <span className="community-event-sub">{t('inGame', { game: e.game.name })}</span>
        )}
      </div>
    </div>
  )
}

/** A player's face. With `link`, it opens their public profile, like their name next to it; it
 * stays out of the tab order and the screen reader, since the name is the same link. */
export function Avatar({
  person,
  className = '',
  link = false,
}: {
  person?: Person
  className?: string
  link?: boolean
}) {
  const face = person?.avatarUrl ? (
    <img src={person.avatarUrl} alt="" loading="lazy" />
  ) : (
    <Icon name="gamepad" />
  )
  const classes = `community-avatar ${className}`.trim()
  return link && person ? (
    <Link
      className={`${classes} community-avatar-link`}
      to={playerLink(person.onlineId)}
      tabIndex={-1}
      aria-hidden="true"
    >
      {face}
    </Link>
  ) : (
    <span className={classes}>{face}</span>
  )
}

function FeedItem({
  event: e,
  person,
  followed,
  mine,
  english,
  readOnly,
  onReact,
  onFollow,
}: {
  event: CommunityEvent
  person?: Person
  followed: boolean
  mine: boolean
  english: boolean
  readOnly: boolean
  onReact: (kind: ReactionKind) => void
  onFollow: (on: boolean) => void
}) {
  const t = useMessages(messages)
  const name = person?.onlineId ?? '—'
  const scene = e.game?.artUrl ?? e.game?.coverUrl ?? e.game?.iconUrl
  return (
    <li className={`community-event ${e.kind}`}>
      {scene && e.kind !== 'medal' && (
        <img className="community-event-scene" src={scene} alt="" loading="lazy" />
      )}
      <div className="community-event-body">
        <header className="community-event-who">
          <Avatar person={person} link />
          {person ? (
            <Link className="community-name" to={playerLink(person.onlineId)}>
              @{name}
            </Link>
          ) : (
            <b className="community-name">@{name}</b>
          )}
          <time dateTime={e.at}>{fmtAgo(e.at)}</time>
          {!mine && !readOnly && (
            <button
              type="button"
              className="ghost sm community-follow"
              aria-pressed={followed}
              aria-label={t(followed ? 'unfollowLabel' : 'followLabel', { name })}
              onClick={() => onFollow(!followed)}
            >
              {t(followed ? 'unfollow' : 'follow')}
            </button>
          )}
        </header>
        {/* What happened, quoted under the player, so it never reads as the player's own data. */}
        <div className="community-event-quote">
          <EventWhat event={e} english={english} />
        </div>
      </div>
      {e.kind !== 'medal' && (
        <Cover
          className="community-event-cover"
          url={e.game?.coverUrl ?? e.game?.iconUrl}
          name={e.game?.name}
        />
      )}
      <div className="community-event-actions">
        <CommunityReactions event={e} name={name} onReact={onReact} readOnly={readOnly} />
        {(e.kind === 'platinum' || e.kind === 'rare') && <Rate rate={e.rate} />}
      </div>
    </li>
  )
}

function FeedSkeleton() {
  // The same pieces as a real card, so nothing moves when the feed arrives.
  return (
    <ol className="community-events" aria-hidden="true">
      {repeat(4, () => (
        <li className="community-event">
          <div className="community-event-body">
            <header className="community-event-who">
              <span className="community-avatar">
                <Sk w="100%" style={{ height: '100%' }} />
              </span>
              <Sk w={110} h={12} />
            </header>
            <div className="community-event-quote">
              <div className="community-event-what">
                <span className="community-event-badge">
                  <Sk w={32} h={32} />
                </span>
                <div className="community-event-text">
                  <Sk w={80} h={10} />
                  <Sk w={180} h={18} />
                </div>
              </div>
            </div>
          </div>
          <span className="community-event-cover">
            <Sk w="100%" style={{ height: '100%' }} />
          </span>
          <div className="community-event-actions">
            <Sk w={84} h={34} />
          </div>
        </li>
      ))}
    </ol>
  )
}
