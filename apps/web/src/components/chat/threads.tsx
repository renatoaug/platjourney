/** The player's conversations with Nexo, one per game, the latest first; the open one is marked. */
import { type CSSProperties, useState } from 'react'
import { defineMessages, getLocale, Language, useMessages } from '../../i18n/i18n'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { repeat, Sk } from '../../ui/skeleton'
import { EmptyState } from '../../ui/states'
import './threads.css'

/** What /api/chat/threads sends for each conversation. */
export interface ChatThread {
  /** The game's id, or null for the messages without a game. */
  game: string | null
  /** The player's PSN list for the game; null when it is not in the library (read only). */
  np: string | null
  name: string | null
  cover_url: string | null
  messages: number
  last_at: string
  last_question: string | null
  /** The chat's game with nothing said yet: shown on top until a message makes it real. */
  draft?: boolean
}

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Conversas',
    general: 'Geral',
    generalHint: 'Conversas antigas, sem jogo',
    count: { one: '{count} mensagem', other: '{count} mensagens' },
    newConversation: 'Nova conversa',
    emptyTitle: 'Nenhuma conversa ainda',
    empty:
      'Pergunte algo ao Nexo: cada jogo ganha a sua conversa aqui, para você voltar quando quiser.',
    open: 'Conversas',
    close: 'Fechar',
    collapse: 'Recolher conversas',
    expand: 'Expandir conversas',
  },
  [Language.En]: {
    title: 'Conversations',
    general: 'General',
    generalHint: 'Older conversations, no game',
    count: { one: '{count} message', other: '{count} messages' },
    newConversation: 'New conversation',
    emptyTitle: 'No conversations yet',
    empty:
      'Ask Nexo something: each game gets its own conversation here, to come back to any time.',
    open: 'Conversations',
    close: 'Close',
    collapse: 'Collapse conversations',
    expand: 'Expand conversations',
  },
})

const COLLAPSED = 'nexo-threads-collapsed'

/** A question as one plain line: the bold and code marks a tip question carries go. */
const bare = (text: string | null) => (text ?? '').replace(/\*\*|__|`/g, '').trim()

/** The key a conversation is read by: its game, or "none". */
export const threadKey = (t: Pick<ChatThread, 'game'>) => t.game ?? 'none'

function when(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short' })
}

/** One conversation in the list; `iconOnly` (the list collapsed) names it in a tooltip instead. */
function ThreadRow({
  thread,
  index,
  current,
  iconOnly,
  onPick,
}: {
  thread: ChatThread
  index: number
  current: boolean
  iconOnly: boolean
  onPick: (thread: ChatThread) => void
}) {
  const t = useMessages(messages)
  const name = thread.game ? (thread.name ?? '') : t('general')
  return (
    <li style={{ '--i': index } as CSSProperties}>
      <button
        type="button"
        className={thread.draft ? 'is-draft' : undefined}
        aria-current={current ? 'true' : undefined}
        aria-label={iconOnly ? name : undefined}
        data-tip={iconOnly ? name : undefined}
        onClick={() => onPick(thread)}
      >
        {thread.game ? (
          <Cover url={thread.cover_url} name={thread.name ?? ''} className="nexo-thread-cover" />
        ) : (
          <span className="nexo-thread-cover nexo-thread-general" aria-hidden="true">
            <Icon name="nexo" />
          </span>
        )}
        <span className="nexo-thread-text">
          <b>{thread.game ? thread.name : t('general')}</b>
          {thread.draft ? (
            <small className="nexo-thread-draft">{t('newConversation')}</small>
          ) : (
            <>
              <span>{bare(thread.last_question) || (thread.game ? '' : t('generalHint'))}</span>
              <small>
                {when(thread.last_at)} · {t('count', { count: thread.messages })}
              </small>
            </>
          )}
        </span>
      </button>
    </li>
  )
}

export function ChatThreads({
  threads,
  active,
  onPick,
  open = false,
  onClose,
}: {
  threads: ChatThread[] | null
  /** The key of the conversation on screen. */
  active: string
  onPick: (thread: ChatThread) => void
  /** On a phone the list is a sheet over the chat. */
  open?: boolean
  onClose?: () => void
}) {
  const t = useMessages(messages)
  // Collapsed, the list keeps only the covers; the choice is remembered on this browser.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED) === '1'
    } catch {
      return false
    }
  })
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED, next ? '1' : '0')
    } catch {}
  }
  return (
    <aside
      className={`nexo-threads${open ? ' open' : ''}${collapsed && !open ? ' collapsed' : ''}`}
      aria-label={t('title')}
    >
      <div className="nexo-threads-head">
        <span className="eyebrow">{t('title')}</span>
        <button
          type="button"
          className="nexo-threads-collapse"
          aria-label={t(collapsed ? 'expand' : 'collapse')}
          aria-expanded={!collapsed}
          data-tip={t(collapsed ? 'expand' : 'collapse')}
          onClick={toggle}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
        </button>
        {onClose && (
          <button
            type="button"
            className="nexo-threads-close"
            aria-label={t('close')}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      {threads === null && (
        <ul aria-hidden="true">
          {repeat(3, (i) => (
            <li key={i} className="nexo-thread-skeleton">
              <Sk w={38} h={50} />
              <span className="nexo-thread-text">
                <Sk w="70%" />
                <Sk w="90%" />
              </span>
            </li>
          ))}
        </ul>
      )}
      {threads && !threads.length && (
        <EmptyState className="nexo-threads-empty" icon="nexo" title={t('emptyTitle')}>
          {t('empty')}
        </EmptyState>
      )}
      <ul>
        {(threads ?? []).map((thread, i) => (
          <ThreadRow
            key={threadKey(thread)}
            thread={thread}
            index={i}
            current={threadKey(thread) === active}
            iconOnly={collapsed && !open}
            onPick={onPick}
          />
        ))}
      </ul>
    </aside>
  )
}

/** The phone's way into the list: a button above the chat. */
export function ChatThreadsToggle({ onOpen }: { onOpen: () => void }) {
  const t = useMessages(messages)
  return (
    <button type="button" className="button ghost sm nexo-threads-toggle" onClick={onOpen}>
      <Icon name="layers" />
      {t('open')}
    </button>
  )
}
