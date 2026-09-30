/** The game being played now: hero, the session plan, trophies and the guide side by side. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { Guide, GuideSkeleton } from '../components/guide'
import { Hero, HeroSkeleton } from '../components/hero'
import { PlanCard } from '../components/plan'
import { TrophyList } from '../components/trophy-list'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { CurrentGame } from '../lib/types'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Jogo atual',
    lead: 'Guia, missables e cada troféu com seu progresso.',
    askNexo: 'perguntar ao Nexo',
    trophies: 'Troféus',
  },
  [Language.En]: {
    title: 'Current game',
    lead: 'Guide, missables and every trophy with your progress.',
    askNexo: 'ask Nexo',
    trophies: 'Trophies',
  },
})

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
  return (
    <Page path="/game">
      <div className="page-head">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>
        <div className="chips">
          <Link className="chip" to="/nexo">
            {t('askNexo')}
          </Link>
        </div>
      </div>
      <div className="card hero" id="game-hero">
        {loading ? <HeroSkeleton /> : <Hero game={current} />}
      </div>
      {/* Without a game the hero says how to start one; there is nothing to plan or list yet. */}
      {current !== null && (
        <>
          {plan}
          <div className="grid cols-2 game-columns" style={{ marginTop: 16 }}>
            <div className="card" id="trophies-card">
              {loading ? <h2>{t('trophies')}</h2> : null}
              <TrophyList trophies={current?.trophies ?? null} prefix="t" np={current?.np} />
            </div>
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
          </div>
        </>
      )}
    </Page>
  )
}

export function Game() {
  const { data } = useApp()
  return <GameScreen current={data ? data.current : undefined} plan={<PlanCard />} />
}
