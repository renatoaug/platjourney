/** Notification bell and its panel, paged. Opening the panel marks them read on the server, so every device agrees. */
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { fmtDay, fmtTime } from '../lib/format'
import { md } from '../lib/text'
import type { Tip } from '../lib/types'
import { Icon } from '../ui/icon'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import { KIND_ICON, kindLabel, messages as tipMessages, titleHref } from './tip'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Notificações',
    titleUnread: {
      one: 'Notificações, {count} nova',
      other: 'Notificações, {count} novas',
    },
    readAll: 'Ler tudo',
    loadFailed: 'Não conseguimos carregar as notificações.',
    empty:
      'Nenhuma notificação ainda. O Nexo avisa aqui quando você começa um jogo ou pega um troféu.',
    seeHistory: 'Ver histórico completo',
    pages: 'Páginas de notificações',
    page: 'Página {page}',
  },
  [Language.En]: {
    title: 'Notifications',
    titleUnread: {
      one: 'Notifications, {count} new',
      other: 'Notifications, {count} new',
    },
    readAll: 'Read all',
    loadFailed: 'Could not load notifications.',
    empty: 'No notifications yet. Nexo lets you know here when you start a game or earn a trophy.',
    seeHistory: 'See full history',
    pages: 'Notification pages',
    page: 'Page {page}',
  },
})

const PAGE = 8

type Notice = Tip & { read_at?: string | null }
type Loaded = { items: Notice[]; total: number } | 'loading' | 'error'

function NotifItem({ n, i, onNavigate }: { n: Notice; i: number; onNavigate: () => void }) {
  const t = useMessages(messages)
  const tipT = useMessages(tipMessages)
  const text = useRef<HTMLDivElement>(null)
  const [clamped, setClamped] = useState(false)
  const [open, setOpen] = useState(false)
  // Long notices start clamped; "Ler tudo" only where there is more to read.
  useLayoutEffect(() => {
    const el = text.current
    if (el) setClamped(el.scrollHeight > el.clientHeight + 2)
  }, [])
  const kind = kindLabel(tipT, n.kind)
  return (
    <article
      className={`notif-item kind-${n.kind}${n.read_at ? '' : ' is-new'}${open ? ' is-open' : ''}`}
      style={{ '--i': i } as CSSProperties}
    >
      <span className="notif-icon">
        <Icon name={KIND_ICON[n.kind] ?? 'nexo'} />
      </span>
      <div className="notif-body">
        <div className="notif-head">
          {n.game ? (
            <Link to={titleHref(n.game.id)} onClick={onNavigate}>
              {n.game.name}
            </Link>
          ) : (
            <span>{tipT('library')}</span>
          )}
          <span className={`k kind-${n.kind}`}>{kind}</span>
        </div>
        <div
          ref={text}
          className="notif-text md"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: md() escapes the text before adding its own tags
          dangerouslySetInnerHTML={{ __html: md(n.content) }}
        />
        <div className="notif-foot">
          <time dateTime={n.created_at}>
            {fmtDay(n.created_at)} · {fmtTime(n.created_at)}
          </time>
          {clamped && !open && (
            <button type="button" className="notif-more" onClick={() => setOpen(true)}>
              {t('readAll')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function Notifications() {
  const t = useMessages(messages)
  const { data, setData } = useApp()
  const unread = data?.unread ?? 0
  const [state, setState] = useState<'closed' | 'open' | 'closing'>('closed')
  const [page, setPage] = useState(1)
  const [loaded, setLoaded] = useState<Loaded>('loading')
  const [ring, setRing] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined)

  const load = useCallback(async (p: number) => {
    setPage(p)
    setLoaded('loading')
    try {
      const d = await api<{ items: Notice[]; total: number }>(
        `/api/notifications?page=${p}&size=${PAGE}`,
      )
      setLoaded({ items: d.items, total: d.total })
    } catch {
      setLoaded('error')
    }
  }, [])

  const close = useCallback(() => {
    setState('closing')
    clearTimeout(closing.current)
    closing.current = setTimeout(() => setState('closed'), 160)
  }, [])

  const open = () => {
    clearTimeout(closing.current)
    setState('open')
    if (unread) setRing((r) => r + 1)
    // The list loads before the read mark, so new items still show highlighted.
    load(1).then(() => {
      if (!unread) return
      setData((d) => ({ ...d, unread: 0 }))
      api('/api/notifications/read', {}).catch(() => {})
    })
  }

  useEffect(() => {
    if (state !== 'open') return
    const outside = () => close()
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('click', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('click', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [state, close])

  const pages =
    loaded !== 'loading' && loaded !== 'error' ? Math.max(1, Math.ceil(loaded.total / PAGE)) : 1
  const shown = state !== 'closed'

  return (
    <div className="notif">
      <button
        ref={button}
        key={ring}
        className={`icon-button notif-button${ring ? ' ring' : ''}`}
        type="button"
        id="notif-button"
        aria-label={unread ? t('titleUnread', { count: unread }) : t('title')}
        aria-expanded={state === 'open'}
        aria-controls="notif-panel"
        // The tooltip would sit on top of the open panel.
        data-tip={shown ? undefined : t('title')}
        onClick={(e) => {
          e.stopPropagation()
          state === 'open' ? close() : open()
        }}
      >
        <Icon name="bell" />
        <span className="notif-badge" id="notif-badge" hidden={unread === 0}>
          {unread > 9 ? '9+' : String(unread)}
        </span>
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the outside-click handler from closing the panel */}
      <section
        className={`notif-panel${state === 'open' ? ' is-open' : ''}${state === 'closing' ? ' is-closing' : ''}`}
        id="notif-panel"
        aria-label={t('title')}
        hidden={!shown}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="notif-top">
          <b>{t('title')}</b>
          {typeof loaded === 'object' && <span>{loaded.total}</span>}
        </header>
        <div className="notif-list">
          {loaded === 'loading' &&
            repeat(3, () => (
              <div className="row">
                <span className="rank">
                  <Sk w="14px" h={16} />
                </span>
                <Sk w="68px" h={44} style={{ borderRadius: 4, flex: 'none' }} />
                <div className="grow">
                  <Sk w="60%" h={12} />
                  <Sk w="40%" h={10} style={{ marginTop: 8 }} />
                  <Sk w="100%" h={3} style={{ marginTop: 10 }} />
                </div>
                <Sk w="34px" h={18} />
              </div>
            ))}
          {loaded === 'error' && <ErrorState>{t('loadFailed')}</ErrorState>}
          {typeof loaded === 'object' &&
            (loaded.items.length ? (
              loaded.items.map((n, i) => <NotifItem key={n.id} n={n} i={i} onNavigate={close} />)
            ) : (
              <EmptyState>{t('empty')}</EmptyState>
            ))}
        </div>
        {typeof loaded === 'object' && (
          <footer className="notif-bottom">
            <Link className="text-link notif-all" to="/history" onClick={close}>
              {t('seeHistory')} <Icon name="arrow" />
            </Link>
            {pages > 1 && (
              <nav className="notif-pages" aria-label={t('pages')}>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === page ? 'page' : undefined}
                    aria-label={t('page', { page: n })}
                    onClick={() => n !== page && load(n)}
                  >
                    {n}
                  </button>
                ))}
              </nav>
            )}
          </footer>
        )}
      </section>
    </div>
  )
}
