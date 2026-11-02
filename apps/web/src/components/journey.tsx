import type { ReactNode } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { shownProgress } from '../lib/progress'
import { tintStyle } from '../lib/tint'
import type { CurrentGame } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { GameBackdrop, ScenesButton, useScene } from './game-backdrop'
import { GameColumns } from './game-columns'
import { GameNav, type GameSection } from './game-nav'
import { Guide, GuideSkeleton } from './guide'
import { Hero, HeroSkeleton } from './hero'
import { JourneyLink } from './journey-link'
import { nexoHref } from './tip'
import { TrophyList, TrophyListSkeleton } from './trophy-list'
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
    trophies: 'Seus troféus',
    guide: 'Consultar o guia completo',
    plan: 'Planejar minha sessão',
    session: 'Roteiro da sessão',
    remaining: '{count} pendentes no jogo base',
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
    trophies: 'Your trophies',
    guide: 'Read the complete guide',
    plan: 'Plan my session',
    session: 'Session route',
    remaining: '{count} left in the base game',
    source: 'From the guide',
    sync: 'Updated from PSN',
    unavailable: 'Progress appears after syncing.',
    onePlan: 'You keep one session route at a time. Building another replaces the previous one.',
  },
})

const SECTIONS: [GameSection, string][] = [
  ['plan', 'journey-session'],
  ['trophies', 'journey-trophies'],
  ['guide', 'journey-guide-section'],
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
  const next = focus?.trophy
  const missing = c.trophies.filter(
    (x) => !x.earned && x.type !== 'platinum' && x.groupId === 'default',
  ).length
  return (
    <div className="journey">
      <GameBackdrop src={c.game.art_url ?? c.icon} shots={shots} at={scene} tint={c.game.tint} />
      <JourneyActions back={back}>
        <ScenesButton shots={shots} at={scene} name={c.name} onGo={setScene} />
      </JourneyActions>
      <div id="journey-hero" className="hero immersive tinted" style={tintStyle(c.game.tint)}>
        <Hero
          game={c}
          heading={1}
          cta={false}
          tools={<ScenesButton shots={shots} at={scene} name={c.name} onGo={setScene} />}
          hideTools={!!back}
        />
      </div>
      <GameNav sections={SECTIONS} hero="journey-hero" name={c.name} progress={progress} />
      <div className="journey-focus card">
        <span className="eyebrow">
          <Icon name="nexo" /> {t('next')}
        </span>
        <h2>{done ? t('done') : (next?.name ?? t('unknown'))}</h2>
        <p>{done ? t('doneBody') : (next?.detail ?? t('unknownBody'))}</p>
        {focus?.trick && <p className="journey-trick">{focus.trick}</p>}
        {next && (
          <small>
            {t('source')} · {focus?.phase}
            {focus?.behind ? ` · ${t('pending')}` : ''}
          </small>
        )}
        <JourneyLink className="button" to={nexoHref(c.np, c.name, next?.name)}>
          <Icon name="nexo" />
          {next ? t('ask') : t('talk')}
        </JourneyLink>
        {next && <p className="journey-basis">{t('basis')}</p>}
      </div>
      {focus?.missable && (
        <aside className="journey-warning" aria-label={t('attention')}>
          <Icon name="warning" />
          <div>
            <b>
              {t('attention')} · {focus.missable.trophy}
            </b>
            <p>{focus.missable.when}</p>
          </div>
        </aside>
      )}
      <details className="journey-session" id="journey-session">
        <summary>
          <Icon name="clock" />
          {t('plan')}
          <Icon name="chevron-down" />
        </summary>
        <p>{t('onePlan')}</p>
        {plan}
      </details>
      <GameColumns
        tabs
        trophies={
          <section className="journey-trophies" id="journey-trophies">
            <TrophyList
              trophies={c.trophies}
              np={c.np}
              prefix="journey-t"
              heading={t('trophies')}
              note={t('remaining', { count: missing })}
            />
          </section>
        }
        guide={
          <section className="journey-guide" id="journey-guide-section">
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
        }
      />
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
        <HeroSkeleton cta={false} aside={false} gallery={gallery} />
      </div>
      <div className="game-nav" aria-hidden="true">
        <Sk w="186px" h={52} style={{ borderRadius: 'var(--radius-pill)' }} />
      </div>
      <div className="journey-focus card" aria-hidden="true">
        <span className="eyebrow">
          <Sk w="140px" h={12} />
        </span>
        <h2>
          <Sk w="65%" h={30} />
        </h2>
        <p>
          <Sk w="95%" h={18} />
        </p>
        <p>
          <Sk w="75%" h={18} />
        </p>
        <Sk w="180px" h={48} />
      </div>
      <details className="journey-session">
        <summary>
          <Icon name="clock" />
          {t('plan')}
          <Icon name="chevron-down" />
        </summary>
      </details>
      <GameColumns
        tabs
        trophies={
          <section className="journey-trophies">
            <div className="trophy-section-heading">
              <h2>{t('trophies')}</h2>
            </div>
            <TrophyListSkeleton />
          </section>
        }
        guide={
          <section className="journey-guide">
            <GuideSkeleton />
          </section>
        }
      />
    </div>
  )
}
