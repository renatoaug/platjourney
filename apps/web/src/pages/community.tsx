import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { CommunityFeed, type FeedState } from '../components/community/community-feed'
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
import './community.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Comunidade',
    title: 'Quem está caçando platina',
    lead: 'As platinas, os troféus raros e as medalhas dos jogadores do PlatJourney, direto da PSN.',
    tabs: 'Seções da comunidade',
    feed: 'Feed',
    rankings: 'Rankings',
    games: 'Jogos',
  },
  [Language.En]: {
    eyebrow: 'Community',
    title: 'Who is hunting platinums',
    lead: 'PlatJourney players’ platinums, rare trophies and medals, straight from PSN.',
    tabs: 'Community sections',
    feed: 'Feed',
    rankings: 'Rankings',
    games: 'Games',
  },
})

type Tab = 'feed' | 'rankings' | 'games'
const TABS: Tab[] = ['feed', 'rankings', 'games']

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

  const [scope, setScope] = useState<FeedScope>('all')
  const [feed, setFeed] = useState<FeedState>({ status: 'loading' })
  const [feedTry, setFeedTry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: feedTry asks for a retry
  useEffect(() => {
    let live = true
    setFeed({ status: 'loading' })
    fetchFeed(scope)
      .then((page) => live && setFeed({ status: 'ok', ...page }))
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

  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [ranks, setRanks] = useState<RankingsState>({ status: 'loading' })
  const [rankTry, setRankTry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: rankTry asks for a retry
  useEffect(() => {
    if (tab !== 'rankings') return
    let live = true
    setRanks({ status: 'loading' })
    fetchRankings(period)
      .then((data) => live && setRanks({ status: 'ok', data }))
      .catch(() => live && setRanks({ status: 'error' }))
    return () => {
      live = false
    }
  }, [tab, period, rankTry])

  const [games, setGames] = useState<GamesState>({ status: 'loading' })
  const [gamesTry, setGamesTry] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: gamesTry asks for a retry
  useEffect(() => {
    if (tab !== 'games') return
    let live = true
    setGames({ status: 'loading' })
    fetchCommunityGames()
      .then((data) => live && setGames({ status: 'ok', data }))
      .catch(() => live && setGames({ status: 'error' }))
    return () => {
      live = false
    }
  }, [tab, gamesTry])

  // The page's backdrop: the art of the newest event that has some.
  const art =
    feed.status === 'ok' ? (feed.events.find((e) => e.game?.artUrl)?.game?.artUrl ?? null) : null

  return (
    <CommunityView tab={tab} onTab={setTab} art={art}>
      {tab === 'feed' ? (
        <div className="community-feed-layout">
          <CommunityFeed
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
            toolbar={<CommunityVisibility onChange={() => setFeedTry((v) => v + 1)} />}
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
              {t(key)}
            </button>
          ))}
        </fieldset>
        {children}
      </div>
    </Page>
  )
}
