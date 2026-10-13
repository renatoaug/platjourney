/** Search from anywhere: ⌘K (Ctrl+K) or "/" opens it, and it finds catalog games (the ones with a
 * guide first) and the app's screens. Arrows move, Enter opens, Esc closes. */
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { GuideCardItem, GuidesPage } from '../pages/guides'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { titleHref } from './tip'
import './command-palette.css'

const messages = defineMessages({
  [Language.PtBR]: {
    open: 'Buscar jogos',
    label: 'Buscar no PlatJourney',
    placeholder: 'Buscar jogos, guias e telas…',
    games: 'Jogos',
    pages: 'Telas',
    recent: 'Vistos há pouco',
    guide: 'Com guia',
    noGuide: 'Sem guia ainda',
    hours: '~{hours}h',
    difficulty: 'Dificuldade {value}/10',
    empty: 'Nenhum jogo com “{query}”.',
    emptyHint: 'Peça o jogo na tela Guias e ele entra no catálogo.',
    failed: 'A busca falhou. Tenta de novo.',
    hint: '↑↓ para escolher · Enter para abrir · Esc para fechar',
  },
  [Language.En]: {
    open: 'Search games',
    label: 'Search PlatJourney',
    placeholder: 'Search games, guides and screens…',
    games: 'Games',
    pages: 'Screens',
    recent: 'Seen recently',
    guide: 'Has a guide',
    noGuide: 'No guide yet',
    hours: '~{hours}h',
    difficulty: 'Difficulty {value}/10',
    empty: 'No game matching “{query}”.',
    emptyHint: 'Ask for it on the Guides screen and it joins the catalog.',
    failed: 'The search failed. Try again.',
    hint: '↑↓ to choose · Enter to open · Esc to close',
  },
})

export interface PaletteScreen {
  to: string
  label: string
  icon: string
}

type GameHit = Pick<
  GuideCardItem,
  'id' | 'name' | 'cover_url' | 'release_year' | 'platforms' | 'guide'
>
type Entry = { kind: 'game'; item: GameHit } | { kind: 'screen'; screen: PaletteScreen }

const RECENT_KEY = 'palette.recent'
const RECENT_MAX = 5
// Results shown at once; the Guides screen has the rest.
const RESULTS = 8
const DEBOUNCE_MS = 180

function readRecent(): GameHit[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function remember(item: GameHit) {
  try {
    const rest = readRecent().filter((r) => r.id !== item.id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...rest].slice(0, RECENT_MAX)))
  } catch {}
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** True when focus is in a field: "/" types there instead of opening the search. */
const typing = (el: Element | null) =>
  !!el &&
  (el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el as HTMLElement).isContentEditable)

/** The topbar button and the global shortcut; the dialog opens over the page. */
export function CommandPalette({ screens }: { screens: PaletteScreen[] }) {
  const t = useMessages(messages)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === '/' && !typing(document.activeElement)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <>
      <button
        type="button"
        className="palette-open"
        aria-label={t('open')}
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
      >
        <Icon name="search" />
        <span className="palette-open-text">{t('open')}</span>
        <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {open && <PaletteDialog screens={screens} onClose={() => setOpen(false)} />}
    </>
  )
}

const searchGuides = (q: string) => api<GuidesPage>(`/api/guides?q=${encodeURIComponent(q)}`)

export function PaletteDialog({
  screens,
  onClose,
  search = searchGuides,
}: {
  screens: PaletteScreen[]
  onClose: () => void
  /** Stories and tests pass their own; the app asks the guide browser. */
  search?: (query: string) => Promise<GuidesPage>
}) {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ok'; items: GuideCardItem[] }
  >({ status: 'idle' })
  const [active, setActive] = useState(0)
  const [recent] = useState(readRecent)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
    input.current?.focus()
  }, [])

  const q = query.trim()
  useEffect(() => {
    if (q.length < 2) {
      setState({ status: 'idle' })
      return
    }
    let live = true
    setState({ status: 'loading' })
    const timer = setTimeout(() => {
      search(q)
        .then((page) => live && setState({ status: 'ok', items: page.items.slice(0, RESULTS) }))
        .catch(() => live && setState({ status: 'error' }))
    }, DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q, search])

  const matchedScreens = useMemo(
    () => (q ? screens.filter((s) => fold(s.label).includes(fold(q))) : screens),
    [q, screens],
  )
  const games: Extract<Entry, { kind: 'game' }>[] =
    q.length >= 2
      ? state.status === 'ok'
        ? state.items.map((item) => ({ kind: 'game', item }))
        : []
      : recent.map((item) => ({ kind: 'game', item }))
  const picks: Entry[] = [
    ...games,
    ...matchedScreens.map((screen) => ({ kind: 'screen' as const, screen })),
  ]
  const safeActive = Math.min(active, Math.max(0, picks.length - 1))

  // A new query starts at the top of the list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on every query change
  useEffect(() => setActive(0), [q])
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [safeActive])

  const choose = (p: Entry) => {
    if (p.kind === 'game') {
      remember(p.item)
      navigate(titleHref(p.item.id))
    } else navigate(p.screen.to)
    onClose()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((safeActive + 1) % Math.max(1, picks.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((safeActive - 1 + picks.length) % Math.max(1, picks.length))
    } else if (e.key === 'Enter' && picks[safeActive]) {
      e.preventDefault()
      choose(picks[safeActive])
    }
  }

  let index = 0
  const row = (p: Entry) => {
    const i = index++
    const on = i === safeActive
    const common = {
      key: p.kind === 'game' ? p.item.id : p.screen.to,
      id: `palette-${i}`,
      'data-index': i,
      role: 'option',
      'aria-selected': on,
      className: `palette-row${on ? ' on' : ''}`,
      onMouseMove: () => setActive(i),
      onClick: () => choose(p),
    }
    if (p.kind === 'screen')
      return (
        <div {...common}>
          <span className="palette-icon">
            <Icon name={p.screen.icon} />
          </span>
          <span className="palette-name">{p.screen.label}</span>
          <Icon name="arrow-right" className="palette-go" />
        </div>
      )
    const g = p.item.guide
    return (
      <div {...common}>
        <Cover url={p.item.cover_url} name={p.item.name} className="palette-cover" />
        <span className="palette-text">
          <span className="palette-name">{p.item.name}</span>
          <span className="palette-sub">
            {[
              p.item.release_year,
              p.item.platforms?.filter((x) => x === 'PS4' || x === 'PS5').join(' · '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        {g ? (
          <span className="palette-facts">
            {g.difficulty > 0 && <span>{t('difficulty', { value: g.difficulty })}</span>}
            {g.hours > 0 && <span>{t('hours', { hours: g.hours })}</span>}
            <span className="pill ok">{t('guide')}</span>
          </span>
        ) : (
          <span className="palette-facts muted">{t('noGuide')}</span>
        )}
      </div>
    )
  }

  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label={t('label')}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // A click on the backdrop closes; Esc closes through onCancel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="palette-box">
        <div className="palette-field">
          <Icon name="search" />
          <input
            ref={input}
            type="search"
            value={query}
            placeholder={t('placeholder')}
            aria-label={t('label')}
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={picks.length ? `palette-${safeActive}` : undefined}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={list}>
          {(games.length > 0 || (q.length >= 2 && state.status !== 'idle')) && (
            <div className="palette-group" role="presentation">
              {q.length >= 2 ? t('games') : t('recent')}
            </div>
          )}
          {q.length >= 2 && state.status === 'loading' && (
            <div className="palette-loading" role="presentation" aria-busy="true">
              {[0, 1, 2].map((n) => (
                <span key={n} className="palette-row">
                  <Sk w={32} h={42} />
                  <span className="palette-text">
                    <Sk w="60%" h={12} />
                    <Sk w="35%" h={10} />
                  </span>
                </span>
              ))}
            </div>
          )}
          {q.length >= 2 && state.status === 'error' && (
            <div className="palette-empty" role="alert">
              {t('failed')}
            </div>
          )}
          {q.length >= 2 && state.status === 'ok' && !state.items.length && (
            <div className="palette-empty" role="presentation">
              <strong>{t('empty', { query: q })}</strong>
              <span>{t('emptyHint')}</span>
            </div>
          )}
          {games.map(row)}
          {matchedScreens.length > 0 && (
            <div className="palette-group" role="presentation">
              {t('pages')}
            </div>
          )}
          {matchedScreens.map((screen) => row({ kind: 'screen', screen }))}
        </div>
        <div className="palette-hint">{t('hint')}</div>
      </div>
    </dialog>
  )
}
