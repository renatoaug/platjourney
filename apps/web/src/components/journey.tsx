import type { ReactNode } from 'react'
import { trophyMatches } from '../../../../shared/journey/ongoing'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { shownProgress } from '../lib/progress'
import { tintStyle } from '../lib/tint'
import { trophyName } from '../lib/trophy-text'
import type { CurrentGame, Trophy } from '../lib/types'
import { useMedia, WIDE } from '../lib/use-media'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { GameBackdrop, ScenesButton, useScene } from './game-backdrop'
import { GameDesk } from './game-desk'
import {
  countedTrophies,
  GameOverview,
  GameSubpage,
  type GameView,
  useGameView,
  useViewTitle,
} from './game-overview'
import { GameAbout } from './game-showcase'
import { Guide } from './guide'
import { TrophyList, TrophyListSkeleton } from './trophy-list'
import { TrophyRoadmap } from './trophy-roadmap'
import './journey.css'
import { useNexoTarget } from './nexo-bubble'
import { nexoHref } from './tip'

const messages = defineMessages({
  [Language.PtBR]: {
    attention: 'Antes de avançar',
    onePlan: 'Você mantém um roteiro de sessão por vez. Montar outro substitui o anterior.',
  },
  [Language.En]: {
    attention: 'Before moving on',
    onePlan: 'You keep one session route at a time. Building another replaces the previous one.',
  },
})

function scopedProgress(c: CurrentGame, includeDlc: boolean) {
  return c.groups?.base
    ? shownProgress(c.groups.base, c.groups.dlc, includeDlc).progress
    : c.progress
}

function JourneyWarning({
  warning,
  trophies,
}: {
  warning: NonNullable<CurrentGame['focus']>['missable']
  trophies: Trophy[]
}) {
  const t = useMessages(messages)
  if (!warning) return null
  // The guide names it in pt-BR: the list's own entry gives the name in the player's language.
  const found = trophies.find((x) => trophyMatches(x, warning.trophy))
  return (
    <aside className="journey-warning" aria-label={t('attention')}>
      <div className="journey-warning-heading">
        <Icon name="warning" /> <span>{t('attention')}</span>
      </div>
      <b>{found ? trophyName(found) : warning.trophy}</b>
      <p>
        <GuideText text={warning.when} />
      </p>
    </aside>
  )
}

/** What one of the game's own pages holds: the route (a preview for a catalog game), the guide,
 * the session route or the facts. */
function JourneyPage({
  view,
  game: c,
  plan,
  catalog,
  np,
  wide = false,
}: {
  view: GameView
  game: CurrentGame
  plan?: ReactNode
  catalog: boolean
  np: string
  /** A large screen: the journey as a board, the route beside the chosen trophy. */
  wide?: boolean
}) {
  const t = useMessages(messages)
  const done = c.trophies.some((x) => x.type === 'platinum' && x.earned)
  const focus = done || c.guide?.unobtainable || catalog ? null : c.focus
  return (
    <>
      {view === 'journey' &&
        (catalog ? (
          c.trophies.length > 0 && (
            <TrophyRoadmap
              key={np}
              preview
              layout={wide ? 'route' : 'path'}
              game={{ game: c.game, name: c.name, np, trophies: c.trophies, guide: c.guide }}
            />
          )
        ) : (
          <>
            <TrophyRoadmap key={c.np} game={c} layout={wide ? 'route' : 'path'} />
            <JourneyWarning warning={focus?.missable} trophies={c.trophies} />
          </>
        ))}
      {view === 'guide' && (
        <section className="journey-guide is-page" id="journey-guide-section">
          {!c.guide && <GameAbout game={c.game} name={c.name} />}
          <Guide
            id="journey-guide"
            game={{
              name: c.name,
              guide: c.guide ?? null,
              trophies: c.trophies,
              np,
              deepGuide: c.deepGuide,
              queued: c.queued,
            }}
          />
        </section>
      )}
      {view === 'about' && (
        <section className="journey-about is-page" id="journey-about">
          <GameAbout game={c.game} name={c.name} cover={false} />
        </section>
      )}
      {view === 'session' && !catalog && (
        <section className="journey-session" id="journey-session">
          <p>{t('onePlan')}</p>
          {plan}
        </section>
      )}
    </>
  )
}

/** The game's trophy list: with the player's progress, or the catalog's for a game not owned. */
function JourneyTrophies({ game: c, catalog }: { game: CurrentGame; catalog: boolean }) {
  return (
    <section className="card journey-trophies" id="journey-trophies">
      <TrophyList
        trophies={c.trophies}
        np={catalog ? null : c.np}
        askGame={catalog ? { id: c.game.id, name: c.name } : undefined}
        prefix="journey-t"
        guide={c.guide}
      />
    </section>
  )
}

/** The tab a large screen opens: the one asked for, else the journey when it can be walked. */
function deskTabOf(asked: GameView | null, visitor: boolean, trophies: number): GameView {
  return asked ?? (!visitor && trophies > 0 ? 'journey' : 'trophies')
}

/** The one game page, whether opened from PSN presence, the library or the catalog: the game at a
 * glance, and its journey, guide, session route and facts on their own pages. A catalog game (not
 * in the library) passes `catalog`: its actions under the head, totals instead of progress, the
 * journey as a preview, Nexo and the guide on the catalog game, and no session route. */
export function Journey({
  game: c,
  plan,
  similar,
  back,
  catalog,
  trophies,
}: {
  game: CurrentGame
  plan?: ReactNode
  similar?: ReactNode
  back?: ReactNode
  catalog?: ReactNode
  /** In place of the trophy list, e.g. while a catalog game's list is not on PSN yet. */
  trophies?: ReactNode
}) {
  const includeDlc = useApp().me.includeDlcProgress
  const progress = scopedProgress(c, includeDlc)
  const shots = c.game.screenshot_ids ?? []
  const [scene, setScene] = useScene(shots.length)
  // Nexo and the guide talk about a catalog game by the game, an owned one by its PSN list.
  const np = catalog ? c.game.id : c.np
  // The floating Nexo opens on this game while its page is open.
  useNexoTarget(np ? nexoHref(np, c.name) : null)
  const { view: asked, open, close, select } = useGameView()
  const wide = useMedia(WIDE)
  // The trophy list is the overview's own on a phone: its page is the overview there.
  const view = asked === 'trophies' && !wide ? null : asked
  const title = useViewTitle()
  const visitor = useApp().me.visitor === true
  // The journey opens first on a large screen, unless it is closed (no account) or there is no
  // list to walk yet.
  const deskTab = deskTabOf(asked, visitor, c.trophies.length)
  const scenes = <ScenesButton shots={shots} at={scene} name={c.name} onGo={setScene} />
  const trophyList = trophies ?? <JourneyTrophies game={c} catalog={!!catalog} />
  // A large screen: the game's pages as tabs beside a summary that stays in place.
  if (wide)
    return (
      <div className="journey" style={tintStyle(c.game.tint)}>
        <GameBackdrop src={c.game.art_url ?? c.icon} shots={shots} at={scene} tint={c.game.tint} />
        <GameDesk
          game={c}
          trophies={countedTrophies(c.trophies, includeDlc)}
          progress={progress}
          np={np}
          tab={deskTab}
          onTab={select}
          // The journey takes the whole width: its board has its own summary.
          wide={deskTab === 'journey'}
          catalog={catalog}
          actions={back}
          scenes={scenes}
          page={
            deskTab === 'trophies' ? (
              trophyList
            ) : (
              <JourneyPage view={deskTab} game={c} plan={plan} catalog={!!catalog} np={np} wide />
            )
          }
        />
        {similar}
      </div>
    )
  return (
    <div className="journey" style={tintStyle(c.game.tint)}>
      <GameBackdrop src={c.game.art_url ?? c.icon} shots={shots} at={scene} tint={c.game.tint} />
      {view ? (
        <GameSubpage title={title(view)} name={c.name} onBack={close}>
          <JourneyPage view={view} game={c} plan={plan} catalog={!!catalog} np={np} />
        </GameSubpage>
      ) : (
        <>
          <GameOverview
            game={c}
            progress={progress}
            includeDlc={includeDlc}
            actions={
              <>
                {back ?? <span />}
                {scenes}
              </>
            }
            onOpen={open}
            catalog={catalog}
            trophies={trophyList}
          />
          {similar}
        </>
      )}
    </div>
  )
}

/** The overview's shape while progress is being loaded: the head, the cards, the tiers and the
 * trophy list. */
export function JourneySkeleton() {
  return (
    <div className="journey" aria-busy="true">
      <div className="game-overview">
        <header className="game-overview-head">
          <Sk w="58px" h={78} style={{ flex: 'none', borderRadius: 'var(--radius-control)' }} />
          <div className="game-overview-title">
            <Sk w="38px" h={18} />
            <Sk w="80%" h={22} />
            <Sk w="55%" h={11} />
          </div>
          <Sk w="72px" h={72} style={{ flex: 'none', borderRadius: 'var(--radius-round)' }} />
        </header>
        <Sk w="100%" h={78} style={{ borderRadius: 'var(--radius-card)' }} />
        <Sk w="100%" h={68} style={{ borderRadius: 'var(--radius-card)' }} />
        <div className="game-links">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="game-link">
              <Sk w="34px" h={34} style={{ flex: 'none' }} />
              <span className="game-link-copy">
                <Sk w={`${40 + i * 8}%`} h={14} />
                <Sk w="65%" h={11} />
              </span>
            </div>
          ))}
        </div>
        <section className="card journey-trophies">
          <TrophyListSkeleton />
        </section>
      </div>
    </div>
  )
}
