import type { ReactNode } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { shownProgress } from '../lib/progress'
import { tintStyle } from '../lib/tint'
import type { CurrentGame } from '../lib/types'
import { Icon } from '../ui/icon'
import { GuideText } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { GameBackdrop, ScenesButton, useScene } from './game-backdrop'
import { GameNav, type GameSection } from './game-nav'
import { Guide, GuideSkeleton } from './guide'
import { Hero, HeroSkeleton } from './hero'
import { TrophyList, TrophyListSkeleton } from './trophy-list'
import { TrophyRoadmap, TrophyRoadmapSkeleton } from './trophy-roadmap'
import './journey.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'SUA JORNADA',
    next: 'Seu próximo passo',
    ask: 'Me ajuda com isso',
    attention: 'Antes de avançar',
    pending: 'Pendente no seu roteiro',
    basis: 'Pelo guia e pelos troféus sincronizados. Isso não confirma onde você está no jogo.',
    unknown: 'Vamos escolher o próximo passo juntos.',
    unknownBody:
      'O Nexo pode cruzar seus troféus com o guia. Conte onde você parou para ajustar a orientação.',
    done: 'Platina conquistada.',
    doneBody: 'Sua jornada está registrada. Os troféus e o guia continuam aqui.',
    talk: 'Conversar com Nexo',
    guide: 'Consultar o guia completo',
    plan: 'Planejar minha sessão',
    session: 'Roteiro da sessão',
    source: 'Do guia',
    sync: 'Atualizado pela PSN',
    unavailable: 'O progresso aparece após a sincronização.',
    onePlan: 'Você mantém um roteiro de sessão por vez. Montar outro substitui o anterior.',
  },
  [Language.En]: {
    label: 'YOUR JOURNEY',
    next: 'Your next step',
    ask: 'Help me with this',
    attention: 'Before moving on',
    pending: 'Left on your route',
    basis:
      'Based on the guide and synced trophies. This does not confirm your location in the game.',
    unknown: 'Let’s choose your next step together.',
    unknownBody:
      'Nexo can connect your trophies with the guide. Say where you stopped to adjust the guidance.',
    done: 'Platinum earned.',
    doneBody: 'Your journey is recorded. Your trophies and the guide stay here.',
    talk: 'Talk to Nexo',
    guide: 'Read the complete guide',
    plan: 'Plan my session',
    session: 'Session route',
    source: 'From the guide',
    sync: 'Updated from PSN',
    unavailable: 'Progress appears after syncing.',
    onePlan: 'You keep one session route at a time. Building another replaces the previous one.',
  },
})

const SECTIONS: [GameSection, string][] = [
  ['guide', 'journey-guide-section'],
  ['route', 'journey-roadmap'],
  ['plan', 'journey-session'],
  ['trophies', 'journey-trophies'],
  ['similar', 'similar-games'],
]

function scopedProgress(c: CurrentGame, includeDlc: boolean) {
  return c.groups?.base
    ? shownProgress(c.groups.base, c.groups.dlc, includeDlc).progress
    : c.progress
}

function JourneyActions({ back, children }: { back?: ReactNode; children: ReactNode }) {
  return back ? (
    <div className="game-page-actions">
      {back}
      {children}
    </div>
  ) : null
}

function JourneyWarning({ warning }: { warning: NonNullable<CurrentGame['focus']>['missable'] }) {
  const t = useMessages(messages)
  if (!warning) return null
  return (
    <aside className="journey-warning" aria-label={t('attention')}>
      <div className="journey-warning-heading">
        <Icon name="warning" /> <span>{t('attention')}</span>
      </div>
      <b>{warning.trophy}</b>
      <p>
        <GuideText text={warning.when} />
      </p>
    </aside>
  )
}

/** One owned-game surface, regardless of whether it was opened from PSN presence or the library. */
export function Journey({
  game: c,
  plan,
  similar,
  back,
}: {
  game: CurrentGame
  plan: ReactNode
  similar?: ReactNode
  back?: ReactNode
}) {
  const t = useMessages(messages)
  const includeDlc = useApp().me.includeDlcProgress
  const progress = scopedProgress(c, includeDlc)
  const shots = c.game.screenshot_ids ?? []
  const [scene, setScene] = useScene(shots.length)
  const done = c.trophies.some((x) => x.type === 'platinum' && x.earned)
  const focus = done || c.guide?.unobtainable ? null : c.focus
  return (
    <div className="journey">
      <GameBackdrop src={c.game.art_url ?? c.icon} shots={shots} at={scene} tint={c.game.tint} />
      <JourneyActions back={back}>
        <ScenesButton shots={shots} at={scene} name={c.name} onGo={setScene} />
      </JourneyActions>
      <div id="journey-hero" className="hero immersive tinted" style={tintStyle(c.game.tint)}>
        <Hero game={c} heading={1} cta={false} hideTools />
      </div>
      <GameNav
        sections={SECTIONS}
        hero="journey-hero"
        name={c.name}
        progress={progress}
        tools={
          !back && <ScenesButton compact shots={shots} at={scene} name={c.name} onGo={setScene} />
        }
      />
      {/* The guide first, right under the section bar: what hunters look for before the route. */}
      <section className="card journey-guide" id="journey-guide-section">
        <Guide
          id="journey-guide"
          game={{
            name: c.name,
            guide: c.guide ?? null,
            trophies: c.trophies,
            np: c.np,
            deepGuide: c.deepGuide,
            queued: c.queued,
          }}
        />
      </section>
      <TrophyRoadmap key={c.np} game={c} />
      <JourneyWarning warning={focus?.missable} />
      <details className="journey-session" id="journey-session">
        <summary>
          <Icon name="clock" />
          {t('plan')}
          <Icon name="chevron-down" />
        </summary>
        <p>{t('onePlan')}</p>
        {plan}
      </details>
      <section className="card journey-trophies" id="journey-trophies">
        <TrophyList trophies={c.trophies} np={c.np} prefix="journey-t" guide={c.guide} />
      </section>
      {similar}
    </div>
  )
}

/** The same owned-game hierarchy while progress is being loaded. */
export function JourneySkeleton({ gallery = true }: { gallery?: boolean }) {
  const t = useMessages(messages)
  return (
    <div className="journey" aria-busy="true">
      <div className="hero immersive tinted">
        <HeroSkeleton cta={false} aside={false} gallery={false} />
      </div>
      <div className="game-nav" aria-hidden="true">
        <Sk w="186px" h={52} style={{ borderRadius: 'var(--radius-pill)' }} />
        {gallery && (
          <span className="game-nav-tools">
            <Sk w="48px" h={44} />
          </span>
        )}
      </div>
      <section className="card journey-guide">
        <GuideSkeleton />
      </section>
      <TrophyRoadmapSkeleton />
      <details className="journey-session">
        <summary>
          <Icon name="clock" />
          {t('plan')}
          <Icon name="chevron-down" />
        </summary>
      </details>
      <section className="card journey-trophies">
        <TrophyListSkeleton />
      </section>
    </div>
  )
}
