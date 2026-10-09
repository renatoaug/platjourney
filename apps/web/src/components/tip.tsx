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
      chat: 'chat',
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
      chat: 'chat',
    },
    library: 'Your library',
  },
})

const KINDS = ['start', 'unlock', 'session', 'route', 'server', 'chat']

/** The tag of an activity item ("troféu", "sessão"); an unknown kind shows as it came. */
export const kindLabel = (t: Translator<typeof messages>, kind: string) =>
  KINDS.includes(kind) ? t(`kind.${kind}` as MessageKey<typeof messages>) : kind

export const KIND_ICON: Record<string, string> = {
  start: 'gamepad',
  unlock: 'trophy',
  session: 'clock',
  route: 'compass',
  server: 'globe',
  chat: 'nexo',
}

export const titleHref = (gameId: string) => `/title/game/${encodeURIComponent(gameId)}`

/** The chat, opening on a game of the player's library (its PSN list id) when there is one. */
export const nexoHref = (np?: string | null, name?: string | null) =>
  np ? `/nexo?${new URLSearchParams({ game: np, ...(name ? { name } : {}) })}` : '/nexo'

export function TipItem({ tip: tipItem, compact = false }: { tip: Tip; compact?: boolean }) {
  const tr = useMessages(messages)
  const t = tipItem
  const kind = kindLabel(tr, t.kind)
  if (compact)
    return (
      <div className="tip">
        <b>
          <span className={`k kind-${t.kind}`}>
            <Icon name={KIND_ICON[t.kind] ?? 'nexo'} /> {kind}
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
          <Icon name={KIND_ICON[t.kind] ?? 'nexo'} />
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
