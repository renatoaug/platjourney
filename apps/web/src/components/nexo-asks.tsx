/** Questions ready to send to Nexo from where the player is (a trophy, a notice, a guide part, the
 * home): a tap opens the chat on the game and sends it. */

import { Link } from 'react-router'
import { defineMessages, Language, type Translator, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import { JourneyLink } from './journey-link'
import './nexo-asks.css'

/** Also read by the chat, which sends the same questions from its own chips. */
export const askMessages = defineMessages({
  [Language.PtBR]: {
    label: 'Perguntar ao Nexo',
    trophy: {
      how: 'Como pegar?',
      missable: 'Dá pra perder?',
      when: 'Quando fazer?',
    },
    notice: {
      label: 'Me explica melhor',
      q: 'Me explica melhor o último aviso que você me mandou sobre este jogo.',
    },
    explain: {
      label: 'Me explica essa parte',
      q: 'Me explica esta parte do guia, sem spoiler: {part}',
    },
    first: {
      next: {
        label: 'Próximo troféu fácil',
        q: 'Qual o próximo troféu mais fácil pra eu pegar agora e como?',
      },
      missables: {
        label: 'Tem perdível?',
        q: 'Tem algum troféu perdível que eu preciso ficar de olho agora?',
      },
      left: {
        label: 'Quanto falta?',
        q: 'Quanto falta pra platina e o que é mais demorado?',
      },
    },
  },
  [Language.En]: {
    label: 'Ask Nexo',
    trophy: {
      how: 'How do I get it?',
      missable: 'Can I miss it?',
      when: 'When should I do it?',
    },
    notice: {
      label: 'Tell me more',
      q: 'Tell me more about the last notice you sent me about this game.',
    },
    explain: {
      label: 'Explain this part',
      q: 'Explain this part of the guide, without spoilers: {part}',
    },
    first: {
      next: {
        label: 'Next easy trophy',
        q: 'What is the next easiest trophy I can get right now, and how?',
      },
      missables: {
        label: 'Any missables?',
        q: 'Is there a missable trophy I need to watch out for right now?',
      },
      left: {
        label: 'How much is left?',
        q: 'How much is left for the platinum, and what takes the longest?',
      },
    },
  },
})

/** Nexo on a game: a PSN list id for one in the player's library, a game id (`game:…`) for any
 * game. With a trophy, the chat opens with it attached to the question box; with a question
 * (`ask`, a key of nexo-asks.tsx, and the guide `part` it is about), the chat sends it at once. */
export const nexoHref = (
  np?: string | null,
  name?: string | null,
  trophy?: string | null,
  ask?: string | null,
  part?: string | null,
) =>
  np
    ? `/nexo?${new URLSearchParams({
        game: np,
        ...(name ? { name } : {}),
        ...(trophy ? { trophy } : {}),
        ...(ask ? { ask } : {}),
        ...(part ? { part } : {}),
      })}`
    : '/nexo'

export type TrophyAsk = 'how' | 'missable' | 'when'
type FirstAsk = 'next' | 'missables' | 'left'

export const TROPHY_ASKS: TrophyAsk[] = ['how', 'missable', 'when']
const FIRST_ASKS: FirstAsk[] = ['next', 'missables', 'left']

/** The text a link's question sends; null for a key the app does not know. */
export function askText(
  t: Translator<typeof askMessages>,
  ask: string | null,
  part?: string | null,
): string | null {
  if (!ask) return null
  if ((TROPHY_ASKS as string[]).includes(ask)) return t(`trophy.${ask as TrophyAsk}`)
  if (ask === 'notice') return t('notice.q')
  if (ask === 'explain') return part ? t('explain.q', { part }) : null
  if ((FIRST_ASKS as string[]).includes(ask)) return t(`first.${ask as FirstAsk}.q`)
  return null
}

/** Chips with the questions about one trophy; "can I miss it" only when the guide says it can. */
export function TrophyAsks({
  np,
  name,
  trophy,
  missable = false,
  className = '',
}: {
  np: string
  name?: string | null
  trophy: string
  missable?: boolean
  /** Extra classes on each chip (the journey names its own for the usage events). */
  className?: string
}) {
  const t = useMessages(askMessages)
  const asks = TROPHY_ASKS.filter((k) => k !== 'missable' || missable)
  return (
    <nav className="nexo-asks" aria-label={t('label')}>
      <span className="nexo-asks-label" aria-hidden="true">
        <Icon name="nexo" /> {t('label')}
      </span>
      {asks.map((k) => (
        <JourneyLink
          key={k}
          className={`chip nexo-ask ${className}`.trim()}
          to={nexoHref(np, name, trophy, k)}
        >
          {t(`trophy.${k}`)}
        </JourneyLink>
      ))}
    </nav>
  )
}

/** The first questions, for a player who never wrote to Nexo. */
export function FirstAsks({ np, name }: { np: string; name?: string | null }) {
  const t = useMessages(askMessages)
  return (
    <nav className="nexo-asks" aria-label={t('label')}>
      {FIRST_ASKS.map((k) => (
        <JourneyLink key={k} className="chip nexo-ask" to={nexoHref(np, name, null, k)}>
          {t(`first.${k}.label`)}
        </JourneyLink>
      ))}
    </nav>
  )
}

/** "Tell me more": the chat opens on the notice's game and asks about it. */
export function NoticeAsk({ game, name }: { game: string; name: string }) {
  const t = useMessages(askMessages)
  return (
    <Link className="chip nexo-ask tip-ask" to={nexoHref(game, name, null, 'notice')}>
      <Icon name="nexo" /> {t('notice.label')}
    </Link>
  )
}

/** Nexo's offer after a long stay on a part of the guide: it explains that part. */
export function ExplainAsk({ np, name, part }: { np: string; name?: string | null; part: string }) {
  const t = useMessages(askMessages)
  return (
    <JourneyLink className="chip nexo-ask tip-ask" to={nexoHref(np, name, null, 'explain', part)}>
      <Icon name="nexo" /> {t('explain.label')}
    </JourneyLink>
  )
}
