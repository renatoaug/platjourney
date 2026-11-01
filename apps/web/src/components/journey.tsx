import type { ReactNode } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { CurrentGame } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Guide } from './guide'
import { HeroMeta, HeroProgress, UnobtainableBanner } from './hero'
import { JourneyLink } from './journey-link'
import { nexoHref } from './tip'
import { TrophyList } from './trophy-list'
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

/** One owned-game surface, regardless of whether it was opened from PSN presence or the library. */
export function Journey({ game: c, plan }: { game: CurrentGame; plan: ReactNode }) {
  const t = useMessages(messages)
  const done = c.trophies.some((x) => x.type === 'platinum' && x.earned)
  const focus = done || c.guide?.unobtainable ? null : c.focus
  const next = focus?.trophy
  const missing = c.trophies.filter(
    (x) => !x.earned && x.type !== 'platinum' && x.groupId === 'default',
  ).length
  return (
    <div className="journey">
      <header className="journey-heading">
        <Cover
          className={`cover${c.game.cover_url ? '' : ' journey-icon'}`}
          url={c.game.cover_url ?? c.icon}
          name={c.name}
        />
        <div>
          <span className="eyebrow">
            {t('label')} · {c.platform}
          </span>
          <h1>{c.name}</h1>
          <p>{t('sync')}</p>
        </div>
      </header>
      <HeroProgress game={c} />
      <UnobtainableBanner guide={{ unobtainable: c.guide?.unobtainable }} />
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
      <section className="journey-trophies" id="journey-trophies">
        <header>
          <h2>{t('trophies')}</h2>
          <span>{t('remaining', { count: missing })}</span>
        </header>
        <TrophyList trophies={c.trophies} np={c.np} prefix="journey-t" />
      </section>
      <details className="journey-guide">
        <summary>
          <Icon name="search" />
          {t('guide')}
          <Icon name="chevron-down" />
        </summary>
        <HeroMeta c={c} />
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
      </details>
    </div>
  )
}
