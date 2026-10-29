/** The game being played now: its scenes across the top under the hero and the next trophy, a bar of
 * its sections, the platinum map, the session plan and the guide beside the trophies. */
import type { ReactNode } from 'react'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { GameBackdrop, ScenesButton, useScene } from '../components/game-backdrop'
import { GameColumns } from '../components/game-columns'
import { GameNav, type GameSection } from '../components/game-nav'
import { GameAbout } from '../components/game-showcase'
import { Guide, GuideSkeleton } from '../components/guide'
import { Hero, HeroSkeleton } from '../components/hero'
import { NextTrophy } from '../components/next-trophy'
import { PlanCard } from '../components/plan'
import { TrophyList } from '../components/trophy-list'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { tintStyle } from '../lib/tint'
import type { CurrentGame } from '../lib/types'
import './game.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Jogo atual',
    trophies: 'Troféus',
  },
  [Language.En]: {
    title: 'Current game',
    trophies: 'Trophies',
  },
})

const SECTIONS: [GameSection, string][] = [
  ['plan', 'plan-card'],
  ['guide', 'guide-card'],
  ['trophies', 'trophies-card'],
]

/** The screen for a given state: `current` undefined is still loading, null is no game yet. `plan` is the plan card. */
export function GameScreen({
  current,
  plan,
}: {
  current: CurrentGame | null | undefined
  plan: ReactNode
}) {
  const t = useMessages(messages)
  const loading = current === undefined
  const shots = current?.game.screenshot_ids ?? []
  const [scene, setScene] = useScene(shots.length)
  return (
    <Page path="/game">
      <h1 className="sr-only">{t('title')}</h1>
      {current && (
        <GameBackdrop src={current.icon} shots={shots} at={scene} tint={current.game.tint} />
      )}
      <div className="hero immersive tinted" id="game-hero" style={tintStyle(current?.game.tint)}>
        {loading ? (
          <HeroSkeleton cta={false} />
        ) : (
          <Hero
            game={current}
            // The next trophy's card carries the way to Nexo: no second button off on its own.
            cta={current ? false : undefined}
            tools={
              current && (
                <ScenesButton shots={shots} at={scene} name={current.name} onGo={setScene} />
              )
            }
            aside={
              current && (
                <NextTrophy
                  trophies={current.trophies}
                  guide={current.guide}
                  game={current.game.id}
                  np={current.np}
                  fallback={<GameAbout game={current.game} name={current.name} />}
                />
              )
            }
          />
        )}
      </div>
      {/* Without a game the hero says how to start one; there is nothing to plan or list yet. */}
      {current !== null && (
        <>
          {current && (
            <GameNav
              sections={SECTIONS}
              hero="game-hero"
              name={current.name}
              progress={current.progress}
            />
          )}
          {plan}
          <GameColumns
            id="game-columns"
            style={{ marginTop: 16 }}
            trophies={
              <div className="card" id="trophies-card">
                {loading ? <h2>{t('trophies')}</h2> : null}
                <TrophyList trophies={current?.trophies ?? null} prefix="t" np={current?.np} />
              </div>
            }
            guide={
              <div className="stack">
                <div className="card" id="guide-card">
                  {current ? (
                    <Guide
                      key={current.name}
                      id="guide-card"
                      game={{
                        name: current.name,
                        guide: current.guide ?? null,
                        trophies: current.trophies,
                        deepGuide: current.deepGuide,
                        queued: current.queued === true,
                      }}
                    />
                  ) : (
                    <GuideSkeleton />
                  )}
                </div>
              </div>
            }
          />
        </>
      )}
    </Page>
  )
}

export function Game() {
  const { data } = useApp()
  return <GameScreen current={data ? data.current : undefined} plan={<PlanCard />} />
}
