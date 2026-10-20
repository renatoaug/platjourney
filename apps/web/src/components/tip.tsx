/** Activity item from Nexo (trophy, session, tip): compact for the home screen, full for the history timeline. */
import { Link } from 'react-router'
import {
  defineMessages,
  Language,
  type MessageKey,
  type Translator,
  useMessages,
} from '../i18n/i18n'
import { fmtTime, fmtWhen } from '../lib/format'
import type { Tip } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Markdown } from '../ui/markdown'
import { Sk } from '../ui/skeleton'
import { AppLogo, assistantName } from './app-logo'
import './tip.css'

/** Also read by the notifications panel, which shows the same items. */
export const messages = defineMessages({
  [Language.PtBR]: {
    kind: {
      start: 'início',
      unlock: 'troféu',
      session: 'sessão',
      route: 'rota',
      server: 'servidor',
      deal: 'promoção',
      chat: 'chat',
      assistant: 'assistente',
    },
    library: 'Sua biblioteca',
  },
  [Language.En]: {
    kind: {
      start: 'start',
      unlock: 'trophy',
      session: 'session',
      route: 'route',
      server: 'server',
      deal: 'deal',
      chat: 'chat',
      assistant: 'assistant',
    },
    library: 'Your library',
  },
})

const KINDS = ['start', 'unlock', 'session', 'route', 'server', 'deal', 'chat', 'assistant']

/** The tag of an activity item ("troféu", "sessão"); an unknown kind shows as it came. */
export const kindLabel = (t: Translator<typeof messages>, kind: string) =>
  KINDS.includes(kind) ? t(`kind.${kind}` as MessageKey<typeof messages>) : kind

export const KIND_ICON: Record<string, string> = {
  start: 'gamepad',
  unlock: 'trophy',
  session: 'clock',
  route: 'compass',
  server: 'globe',
  deal: 'tag',
  chat: 'nexo',
}

export const titleHref = (gameId: string) => `/title/game/${encodeURIComponent(gameId)}`

/** The chat, opening on a game: a PSN list id for one in the player's library, a game id
 * (`game:…`) for one outside it. */
/** Nexo on a game; with a trophy, the chat opens with it attached to the question box. */
export const nexoHref = (np?: string | null, name?: string | null, trophy?: string | null) =>
  np
    ? `/nexo?${new URLSearchParams({ game: np, ...(name ? { name } : {}), ...(trophy ? { trophy } : {}) })}`
    : '/nexo'

/** The item's mark: the assistant's logo for a tip it saved, else the kind's icon. */
function KindMark({ tip }: { tip: Tip }) {
  if (tip.kind === 'assistant') return <AppLogo name={tip.assistant ?? ''} />
  return <Icon name={KIND_ICON[tip.kind] ?? 'nexo'} />
}

export function TipItem({ tip: tipItem, compact = false }: { tip: Tip; compact?: boolean }) {
  const tr = useMessages(messages)
  const t = tipItem
  // A tip an assistant saved carries its name instead of the kind.
  const kind = (t.kind === 'assistant' && assistantName(t.assistant)) || kindLabel(tr, t.kind)
  if (compact)
    return (
      <div className="tip">
        <b>
          <span className={`k kind-${t.kind}`}>
            <KindMark tip={t} /> {kind}
          </span>
          {t.game?.name || tr('library')}
        </b>
        <Markdown className="tip-content tip-preview" text={t.content} />
        <time>{fmtWhen(t.created_at)}</time>
      </div>
    )
  return (
    <article className={`entry kind-${t.kind}`}>
      <div className="entry-time">
        <time dateTime={t.created_at}>{fmtTime(t.created_at)}</time>
      </div>
      <div className="entry-marker">
        <span className="entry-icon">
          <KindMark tip={t} />
        </span>
      </div>
      <div className="entry-body">
        {t.game && <Cover url={t.game.cover_url} name={t.game.name} className="entry-cover" />}
        <div className="entry-main">
          <div className="entry-head">
            {t.game?.id ? (
              <Link className="tip-game" to={titleHref(t.game.id)}>
                {t.game.name}
              </Link>
            ) : (
              <span className="tip-game muted">{tr('library')}</span>
            )}
            <span className={`k kind-${t.kind}`}>{kind}</span>
          </div>
          <Markdown className="tip-content" text={t.content} />
        </div>
      </div>
    </article>
  )
}

/** Loading layout of a TipItem. */
export function TipSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="tip">
      <b>
        <Sk w="44px" h={16} />
        <Sk w={compact ? '90px' : '110px'} h={10} />
      </b>
      <Sk w="100%" h={11} />
      <Sk w={compact ? '95%' : '92%'} h={11} style={{ marginTop: 8 }} />
      <Sk w={compact ? '70%' : '64%'} h={11} style={{ marginTop: 8 }} />
      {compact && <Sk w="90px" h={9} style={{ marginTop: 14 }} />}
    </div>
  )
}
