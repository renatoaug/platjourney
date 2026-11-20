/** The journey for someone without an account: the game's route drawn from placeholders, blurred,
 * with the way in on top. The real route (the trophies in order, the tips) is what the account
 * opens. */
import { Link } from 'react-router'
import { useSignInHref } from '../app/visitor'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { CurrentGame, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { TrophyRoadmap } from './trophy-roadmap'
import './visitor-journey.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'COM A SUA CONTA',
    title: 'Sua jornada até a platina',
    lead: 'O PlatJourney lê seus troféus na PSN, monta o caminho deste jogo a partir de onde você está e te mostra:',
    next: 'Qual troféu caçar agora',
    missable: 'O que dá pra perder, antes que seja tarde',
    nexo: 'Dicas do Nexo na hora certa',
    connect: 'Conectar minha PSN',
    already: 'Já tenho conta',
    trophy: 'Troféu {n}',
    phase: 'Fase {n}',
  },
  [Language.En]: {
    eyebrow: 'WITH YOUR ACCOUNT',
    title: 'Your journey to the platinum',
    lead: 'PlatJourney reads your trophies on PSN, builds this game’s route from where you are and shows you:',
    next: 'Which trophy to go for now',
    missable: 'What you can miss, before it’s too late',
    nexo: 'Tips from Nexo when you need them',
    connect: 'Connect my PSN',
    already: 'I have an account',
    trophy: 'Trophy {n}',
    phase: 'Phase {n}',
  },
})

type Game = Pick<CurrentGame, 'game' | 'name' | 'np' | 'trophies' | 'guide'>
type Guide = NonNullable<CurrentGame['guide']>
const DOTS = '••••••••••••••••••••'

/** The journey's shape with nothing to read: the same trophies (how many, of which kind) and the
 * guide's phases, but no name, picture, description, tip or warning. The real names map to
 * "Trophy 1", "Trophy 2"… so the phases still place each one. */
export function lockedRoadmap(
  source: Game,
  label: (n: number) => string,
  phase: (n: number) => string,
): Game & { focus: null } {
  const names = new Map<string, string>()
  const trophies = source.trophies.map((t, i): Trophy => {
    const name = label(i + 1)
    names.set(t.name, name)
    if (t.nameEn) names.set(t.nameEn, name)
    return {
      id: t.id,
      groupId: t.groupId,
      type: t.type,
      hidden: t.hidden,
      earned: false,
      name,
      detail: DOTS,
    }
  })
  const phases = source.guide?.roadmap ?? []
  const guide: Guide | null = phases.length
    ? {
        overview: '',
        difficulty: 0,
        hours: 0,
        playthroughs: 1,
        hasMissables: false,
        hasOnline: false,
        earlyTips: [],
        missables: [],
        onlineTrophies: [],
        glossary: [],
        sources: [],
        roadmap: phases.map((p, i) => ({
          phase: phase(i + 1),
          goal: '',
          trophies: p.trophies.flatMap((n) => names.get(n) ?? []),
        })),
      }
    : null
  return { game: source.game, name: source.name, np: source.np, trophies, guide, focus: null }
}

export function VisitorJourney({ game }: { game: Game }) {
  const t = useMessages(messages)
  const href = useSignInHref()
  const locked = lockedRoadmap(
    game,
    (n) => t('trophy', { n }),
    (n) => t('phase', { n }),
  )
  return (
    <div className="visitor-journey">
      {/* What the journey looks like, from placeholders: blurred, unreadable and unreachable. */}
      <div className="visitor-journey-preview" aria-hidden="true" inert>
        <TrophyRoadmap game={locked} preview />
      </div>
      <section className="card visitor-journey-card" aria-labelledby="visitor-journey-title">
        <header className="visitor-journey-head">
          <span className="visitor-journey-icon">
            <Icon name="compass" />
          </span>
          <div>
            <span className="eyebrow">{t('eyebrow')}</span>
            <h3 id="visitor-journey-title">{t('title')}</h3>
          </div>
        </header>
        <p className="visitor-journey-lead">{t('lead')}</p>
        <ul className="visitor-journey-perks">
          <li>
            <Icon name="target" />
            <span>{t('next')}</span>
          </li>
          <li>
            <Icon name="warning" />
            <span>{t('missable')}</span>
          </li>
          <li>
            <Icon name="nexo" />
            <span>{t('nexo')}</span>
          </li>
        </ul>
        <div className="visitor-journey-actions">
          <Link className="button" to={href} id="visitor-journey-join">
            <Icon name="compass" />
            {t('connect')}
            <Icon name="arrow-right" />
          </Link>
          <Link className="button secondary" to={href} id="visitor-journey-sign-in">
            {t('already')}
          </Link>
        </div>
      </section>
    </div>
  )
}
