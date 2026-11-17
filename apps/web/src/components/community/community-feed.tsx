import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import {
  type CommunityEvent,
  type FeedScope,
  gameLink,
  type MedalKind,
  type Person,
  REACTIONS,
  type ReactionKind,
} from '../../lib/community'
import { fmtAgo, fmtRate } from '../../lib/format'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { EmptyState, ErrorState } from '../../ui/states'
import './community-feed.css'

const messages = defineMessages({
  [Language.PtBR]: {
    feed: 'Feed da comunidade',
    scopes: 'Mostrar',
    all: 'Todos',
    following: 'Quem eu sigo',
    me: 'Eu',
    platinum: 'platinou',
    rare: 'pegou',
    start: 'começou',
    medal: 'ganhou a medalha',
    share: 'só {rate}% têm',
    shareCommon: '{rate}% têm',
    follow: 'Seguir',
    unfollow: 'Seguindo',
    followLabel: 'Seguir {name}',
    unfollowLabel: 'Deixar de seguir {name}',
    react: '{reaction} em {event}: {count}',
    gg: 'GG',
    fire: 'Fogo',
    skull: 'Sofrido',
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
    platinum: 'platinumed',
    rare: 'earned',
    start: 'started',
    medal: 'earned the medal',
    share: 'only {rate}% have it',
    shareCommon: '{rate}% have it',
    follow: 'Follow',
    unfollow: 'Following',
    followLabel: 'Follow {name}',
    unfollowLabel: 'Unfollow {name}',
    react: '{reaction} on {event}: {count}',
    gg: 'GG',
    fire: 'Fire',
    skull: 'Hard-won',
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

const EMOJI: Record<ReactionKind, string> = { gg: '🏆', fire: '🔥', skull: '💀' }
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
  ...rest
}: {
  state: FeedState
  scope: FeedScope
  onScope: (scope: FeedScope) => void
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
      <fieldset className="segmented community-scopes" aria-label={t('scopes')}>
        {(['all', 'following', 'me'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => onScope(s)}>
            {t(s)}
          </button>
        ))}
      </fieldset>
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
      <ol className="community-events">
        {state.events.map((e) => (
          <FeedItem
            key={e.key}
            event={e}
            person={state.people[e.user]}
            followed={state.following.includes(e.user)}
            mine={e.user === me}
            english={english}
            readOnly={readOnly}
            onReact={(kind) => onReact(e, kind)}
            onFollow={(on) => onFollow(e.user, on)}
          />
        ))}
      </ol>
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

/** What happened, after the player's name: "platinou Ghost of Tsushima". */
function EventWhat({ event: e, english }: { event: CommunityEvent; english: boolean }) {
  const t = useMessages(messages)
  const link = gameLink(e.game)
  const game = !e.game ? null : link ? <Link to={link}>{e.game.name}</Link> : <b>{e.game.name}</b>
  if (e.kind === 'medal')
    return (
      <>
        {t('medal')} <b>{t(e.medal)}</b>
      </>
    )
  if (e.kind === 'rare')
    return (
      <>
        {t('rare')} <b>{english ? e.trophyEn || e.trophy : e.trophy}</b>
        {game && <> · {game}</>}
      </>
    )
  return (
    <>
      {t(e.kind === 'platinum' ? 'platinum' : 'start')} {game}
    </>
  )
}

function Rate({ rate }: { rate: number }) {
  const t = useMessages(messages)
  if (!(rate > 0)) return null
  const rare = rate < 5
  return (
    <span className={`community-rate${rare ? ' rare' : ''}`}>
      {t(rare ? 'share' : 'shareCommon', { rate: fmtRate(rate) })}
    </span>
  )
}

function ReactionButton({
  kind,
  event: e,
  name,
  onReact,
  disabled,
}: {
  kind: ReactionKind
  event: CommunityEvent
  name: string
  onReact: (kind: ReactionKind) => void
  disabled: boolean
}) {
  const t = useMessages(messages)
  const count = e.reactions.counts[kind]
  return (
    <button
      type="button"
      className="community-reaction"
      aria-pressed={e.reactions.mine.includes(kind)}
      aria-label={t('react', {
        reaction: t(kind),
        event: `${name} ${e.game?.name ?? ''}`.trim(),
        count,
      })}
      disabled={disabled}
      onClick={() => onReact(kind)}
    >
      <span aria-hidden="true">{EMOJI[kind]}</span>
      {count > 0 && <span className="community-reaction-count">{count}</span>}
    </button>
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
  return (
    <li className={`community-event ${e.kind}`}>
      <span className="community-avatar">
        {person?.avatarUrl ? (
          <img src={person.avatarUrl} alt="" loading="lazy" />
        ) : (
          <Icon name="gamepad" />
        )}
      </span>
      <div className="community-event-body">
        <p className="community-event-line">
          <b className="community-name">@{name}</b> <EventWhat event={e} english={english} />
        </p>
        <p className="community-event-meta">
          <time dateTime={e.at}>{fmtAgo(e.at)}</time>
          {(e.kind === 'platinum' || e.kind === 'rare') && <Rate rate={e.rate} />}
        </p>
        <div className="community-event-actions">
          {REACTIONS.map((kind) => (
            <ReactionButton
              key={kind}
              kind={kind}
              event={e}
              name={name}
              onReact={onReact}
              disabled={readOnly}
            />
          ))}
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
        </div>
      </div>
      {e.kind === 'medal' ? (
        <span className="community-event-art medal" aria-hidden="true">
          {MEDAL_ICON[e.medal]}
        </span>
      ) : (
        <Cover className="community-event-art" url={e.game?.iconUrl} name={e.game?.name} />
      )}
    </li>
  )
}

function FeedSkeleton() {
  return (
    <ol className="community-events" aria-hidden="true">
      {repeat(4, () => (
        <li className="community-event">
          <span className="community-avatar">
            <Sk w="100%" h={40} />
          </span>
          <div className="community-event-body">
            <p className="community-event-line">
              <Sk w="75%" h={16} />
            </p>
            <p className="community-event-meta">
              <Sk w="40%" h={12} />
            </p>
          </div>
          <span className="community-event-art">
            <Sk w="100%" h={56} />
          </span>
        </li>
      ))}
    </ol>
  )
}
