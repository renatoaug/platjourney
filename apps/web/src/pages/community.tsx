import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import {
  CommunityFeed,
  CommunityFeedRail,
  type FeedState,
} from '../components/community/community-feed'
import { CommunityGames, type GamesState } from '../components/community/community-games'
import { CommunityRankings, type RankingsState } from '../components/community/community-rankings'
import { CommunitySide } from '../components/community/community-side'
import { CommunityVisibility } from '../components/community/community-visibility'
import { PageTop } from '../components/page-top'
import { defineMessages, Language, useLocale, useMessages } from '../i18n/i18n'
import {
  type CommunityEvent,
  type FeedScope,
  fetchCommunityGames,
  fetchFeed,
  fetchRankings,
  follow,
  type ReactionKind,
  react,
} from '../lib/community'
import { useMedia, WIDE } from '../lib/use-media'
import { Icon } from '../ui/icon'
import './community.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Comunidade',
    title: 'Quem está caçando platina',
    lead: 'As platinas, os troféus raros e as medalhas dos jogadores do PlatJourney, direto da PSN.',
    tabs: 'Seções da comunidade',
    feed: 'Feed',
    rankings: 'Leaderboard',
    games: 'Jogos',
  },
  [Language.En]: {
    eyebrow: 'Community',
    title: 'Who is hunting platinums',
    lead: 'PlatJourney players’ platinums, rare trophies and medals, straight from PSN.',
    tabs: 'Community sections',
    feed: 'Feed',
    rankings: 'Leaderboard',
    games: 'Games',
  },
})

type Tab = 'feed' | 'rankings' | 'games'
const TABS: Tab[] = ['feed', 'rankings', 'games']
const TAB_ICONS: Record<Tab, string> = { feed: 'flame', rankings: 'crown', games: 'gamepad' }

// What this screen last showed, kept while the app is open: going back to it from a player's
// profile shows the same feed at once instead of its skeleton.
const seen: {
  scope: FeedScope
  period: 'month' | 'year'
  feed: Partial<Record<FeedScope, FeedState>>
  ranks: Partial<Record<'month' | 'year', RankingsState>>
  games: GamesState | null
} = { scope: 'all', period: 'month', feed: {}, ranks: {}, games: null }

export function Community() {
  const { me } = useApp()
  const english = useLocale() === Language.En
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'feed'
  const setTab = (next: Tab) =>
    setParams((before) => {
      const p = new URLSearchParams(before)
      p.set('tab', next)
      return p
    })

  const [scope, setScope] = useState<FeedScope>(() => seen.scope)
  // Seen before (coming back from a profile): shown at once and refreshed in place, so the screen
  // does not flash back to its skeleton.
  const [feed, setFeed] = useState<FeedState>(() => seen.feed[seen.scope] ?? { status: 'loading' })
  const [feedTry, setFeedTry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: feedTry asks for a retry
  useEffect(() => {
    let live = true
    seen.scope = scope
    const kept = seen.feed[scope]
    setFeed(kept ?? { status: 'loading' })
    fetchFeed(scope)
      .then((page) => {
        if (!live) return
        const next: FeedState = { status: 'ok', ...page }
        seen.feed[scope] = next
        setFeed(next)
      })
      .catch(() => live && setFeed({ status: 'error' }))
    return () => {
      live = false
    }
  }, [scope, feedTry])

  const more = useCallback(() => {
    if (feed.status !== 'ok' || !feed.next) return
    setFeed({ ...feed, loadingMore: true })
    fetchFeed(scope, feed.next)
      .then((page) =>
        setFeed({
          ...page,
          status: 'ok',
          events: [...feed.events, ...page.events],
          people: { ...feed.people, ...page.people },
        }),
      )
      .catch(() => setFeed({ ...feed, loadingMore: false }))
  }, [feed, scope])

  const onReact = (event: CommunityEvent, kind: ReactionKind) => {
    if (feed.status !== 'ok') return
    const on = !event.reactions.mine.includes(kind)
    // Shown at once; the server's answer settles the counts.
    const optimistic = (e: CommunityEvent): CommunityEvent =>
      e.key !== event.key
        ? e
        : {
            ...e,
            reactions: {
              counts: {
                ...e.reactions.counts,
                [kind]: Math.max(0, e.reactions.counts[kind] + (on ? 1 : -1)),
              },
              mine: on ? [...e.reactions.mine, kind] : e.reactions.mine.filter((k) => k !== kind),
            },
          }
    setFeed({ ...feed, events: feed.events.map(optimistic) })
    react(event.key, kind, on)
      .then((reactions) =>
        setFeed((now) =>
          now.status === 'ok'
            ? {
                ...now,
                events: now.events.map((e) => (e.key === event.key ? { ...e, reactions } : e)),
              }
            : now,
        ),
      )
      .catch(() => setFeedTry((v) => v + 1))
  }

  const onFollow = (user: string, on: boolean) => {
    if (feed.status !== 'ok') return
    setFeed({
      ...feed,
      following: on ? [...feed.following, user] : feed.following.filter((u) => u !== user),
    })
    follow(user, on)
      .then(({ following }) =>
        setFeed((now) => (now.status === 'ok' ? { ...now, following } : now)),
      )
      .catch(() => setFeedTry((v) => v + 1))
  }

  const [period, setPeriod] = useState<'month' | 'year'>(() => seen.period)
  const [ranks, setRanks] = useState<RankingsState>(
    () => seen.ranks[seen.period] ?? { status: 'loading' },
  )
  const [rankTry, setRankTry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: rankTry asks for a retry
  useEffect(() => {
    if (tab !== 'rankings') return
    let live = true
    seen.period = period
    setRanks(seen.ranks[period] ?? { status: 'loading' })
    fetchRankings(period)
      .then((data) => {
        if (!live) return
        const next: RankingsState = { status: 'ok', data }
        seen.ranks[period] = next
        setRanks(next)
      })
      .catch(() => live && setRanks({ status: 'error' }))
    return () => {
      live = false
    }
  }, [tab, period, rankTry])

  const [games, setGames] = useState<GamesState>(() => seen.games ?? { status: 'loading' })
  const [gamesTry, setGamesTry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: gamesTry asks for a retry
  useEffect(() => {
    if (tab !== 'games') return
    let live = true
    setGames(seen.games ?? { status: 'loading' })
    fetchCommunityGames()
      .then((data) => {
        if (!live) return
        const next: GamesState = { status: 'ok', data }
        seen.games = next
        setGames(next)
      })
      .catch(() => live && setGames({ status: 'error' }))
    return () => {
      live = false
    }
  }, [tab, gamesTry])

  const wide = useMedia(WIDE)
  const visibility = me.visitor ? null : (
    <CommunityVisibility onChange={() => setFeedTry((v) => v + 1)} />
  )

  // The page's backdrop: the art of the newest event that has some.
  const art =
    feed.status === 'ok' ? (feed.events.find((e) => e.game?.artUrl)?.game?.artUrl ?? null) : null

  return (
    <CommunityView tab={tab} onTab={setTab} art={art}>
      {tab === 'feed' ? (
        <div className={`community-feed-layout${wide ? ' is-wide' : ''}`}>
          {wide && (
            <CommunityFeedRail
              scope={scope}
              onScope={setScope}
              visitor={me.visitor === true}
              toolbar={visibility}
            />
          )}
          <CommunityFeed
            rail={wide}
            state={feed}
            scope={scope}
            onScope={setScope}
            onReact={onReact}
            onFollow={onFollow}
            onMore={more}
            onRetry={() => setFeedTry((v) => v + 1)}
            me={me.id.replace(/^user:/, '')}
            english={english}
            readOnly={me.demo === true}
            visitor={me.visitor === true}
            toolbar={wide ? null : visibility}
          />
          <CommunitySide onTab={setTab} />
        </div>
      ) : tab === 'rankings' ? (
        <CommunityRankings
          state={ranks}
          period={period}
          onPeriod={setPeriod}
          onRetry={() => setRankTry((v) => v + 1)}
        />
      ) : (
        <CommunityGames state={games} onRetry={() => setGamesTry((v) => v + 1)} />
      )}
    </CommunityView>
  )
}

/** The page's frame: the head and the three sections; the section itself comes as children. */
export function CommunityView({
  tab,
  onTab,
  art,
  children,
}: {
  tab: Tab
  onTab: (tab: Tab) => void
  art?: string | null
  children: ReactNode
}) {
  const t = useMessages(messages)
  return (
    <Page path="/community">
      <div className="community-page">
        <PageTop eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} art={art} />
        <fieldset className="community-tabs" aria-label={t('tabs')}>
          {TABS.map((key) => (
            <button key={key} type="button" aria-pressed={tab === key} onClick={() => onTab(key)}>
              <Icon name={TAB_ICONS[key]} /> {t(key)}
            </button>
          ))}
        </fieldset>
        {children}
      </div>
    </Page>
  )
}
