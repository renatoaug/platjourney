/** The panel that adds a game to the interests: a catalog search combobox, the chosen game as a chip, and save/cancel. */
import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { api } from '../../lib/api'
import type { Game, Interest } from '../../lib/types'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'

const messages = defineMessages({
  [Language.PtBR]: {
    add: {
      searching: 'Buscando no catálogo…',
      found: {
        one: '{count} jogos encontrados.',
        other: '{count} jogos encontrados.',
      },
      noneFound: 'Nenhum jogo encontrado no catálogo. Tente outro nome.',
      unavailable: 'A busca está indisponível no momento.',
      unavailableHint: 'Você pode tentar novamente sem apagar o que digitou.',
      chosen: '{name} escolhido. Salve para adicionar aos interesses.',
      inputLabel: 'Jogo para salvar nos interesses',
      placeholder: 'Busque um jogo no catálogo',
      changeLabel: 'Trocar o jogo escolhido',
      change: 'Trocar jogo',
      save: 'Salvar',
      cancel: 'Cancelar inclusão',
      results: 'Jogos do catálogo',
      short: 'Digite mais um caractere para buscar no catálogo.',
      saved: 'Nos interesses',
      emptyTitle: 'Nenhum jogo encontrado',
      emptyHint: 'Tente outro nome ou uma parte do título.',
      retry: 'Tentar novamente',
    },
  },
  [Language.En]: {
    add: {
      searching: 'Searching the catalog…',
      found: {
        one: '{count} game found.',
        other: '{count} games found.',
      },
      noneFound: 'No game found in the catalog. Try another name.',
      unavailable: 'Search is unavailable right now.',
      unavailableHint: 'You can try again without losing what you typed.',
      chosen: '{name} chosen. Save to add it to your interests.',
      inputLabel: 'Game to save to interests',
      placeholder: 'Search the catalog for a game',
      changeLabel: 'Change the chosen game',
      change: 'Change game',
      save: 'Save',
      cancel: 'Cancel adding',
      results: 'Catalog games',
      short: 'Type one more character to search the catalog.',
      saved: 'In interests',
      emptyTitle: 'No game found',
      emptyHint: 'Try another name or part of the title.',
      retry: 'Try again',
    },
  },
})

export const searchCatalog = (query: string) =>
  api<Game[]>(`/api/games/search?q=${encodeURIComponent(query)}`)

const meta = (g: Game) => [g.platforms?.join(' · '), g.release_year].filter(Boolean).join(' · ')

type Results = 'short' | 'skeleton' | 'options' | 'error'

export function GoalAddPanel({
  open,
  busy = false,
  interests,
  draft,
  onDraft,
  selection,
  onSelection,
  onSave,
  onClose,
  inputRef,
  search = searchCatalog,
}: {
  open: boolean
  busy?: boolean
  interests: Interest[]
  draft: string
  onDraft: (draft: string) => void
  selection: Game | null
  onSelection: (game: Game | null) => void
  onSave: (game: Game) => void
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
  /** The catalog search; stories pass a fake one. */
  search?: (query: string) => Promise<Game[]>
}) {
  const t = useMessages(messages)
  const [shown, setShown] = useState(false)
  const [results, setResults] = useState<Results>('options')
  const [options, setOptions] = useState<Game[]>([])
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState('')
  const [announce, setAnnounce] = useState(false)
  const [retry, setRetry] = useState(false)
  const listbox = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Each keystroke bumps it; an answer for an older query is dropped.
  const version = useRef(0)

  useEffect(
    () => () => {
      ++version.current
      clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (active >= 0) listbox.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const existing = (game: Game) => interests.some((g) => g.game.id === game.id)
  const focusInput = () => inputRef.current?.focus({ preventScroll: true })

  const dismiss = () => {
    setShown(false)
    setActive(-1)
  }

  const find = (value: string) => {
    onDraft(value)
    onSelection(null)
    clearTimeout(timer.current)
    const request = ++version.current
    setSearching(false)
    setRetry(false)
    setActive(-1)
    setStatus('')
    const query = value.trim()
    if (!query) {
      setOptions([])
      dismiss()
      return
    }
    setShown(true)
    if (query.length < 2) {
      setOptions([])
      setResults('short')
      return
    }
    setSearching(true)
    // Keep the last answer on screen while the next one loads; skeleton only the first time.
    if (!options.length) setResults('skeleton')
    setStatus(t('add.searching'))
    setAnnounce(true)
    timer.current = setTimeout(async () => {
      try {
        const games = await search(query)
        if (request !== version.current) return
        setSearching(false)
        setOptions(games)
        setResults('options')
        setStatus(games.length ? t('add.found', { count: games.length }) : t('add.noneFound'))
      } catch {
        if (request !== version.current) return
        setSearching(false)
        setOptions([])
        setResults('error')
        setStatus(t('add.unavailable'))
        setRetry(true)
      }
    }, 250)
  }

  const select = (index: number) => {
    const game = options[index]
    if (searching || !game || existing(game)) return
    onSelection(game)
    onDraft(game.name)
    setStatus(t('add.chosen', { name: game.name }))
    dismiss()
    focusInput()
  }

  // The chosen game shows as a chip over the field; clearing it goes back to typing.
  const clearSelection = () => {
    onSelection(null)
    onDraft('')
    focusInput()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (selection && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault()
      clearSelection()
      return
    }
    // Escape also bubbles to the form, which closes the panel.
    if (event.key === 'Escape') {
      ++version.current
      clearTimeout(timer.current)
      setSearching(false)
      dismiss()
      return
    }
    if (searching) {
      if (event.key === 'Enter') event.preventDefault()
      return
    }
    if (!shown || !options.length || results !== 'options') return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActive((active + direction + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (active >= 0) select(active)
    }
  }

  return (
    <div id="goal-add-panel" className={`goal-add-panel${open ? ' is-open' : ''}`} inert={!open}>
      <div className="goal-add-inner">
        <form
          className="goal-form"
          id="goal-add"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
          onSubmit={(event) => {
            event.preventDefault()
            if (selection && draft === selection.name) onSave(selection)
          }}
        >
          <div
            className={`goal-search-field${searching ? ' is-searching' : ''}${selection ? ' has-selection' : ''}`}
          >
            <Icon name="search" />
            <input
              ref={inputRef}
              aria-label={t('add.inputLabel')}
              placeholder={t('add.placeholder')}
              value={draft}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={shown}
              aria-controls="goal-search-results"
              aria-activedescendant={active >= 0 ? `goal-option-${active}` : undefined}
              aria-busy={searching}
              autoComplete="off"
              required
              readOnly={!!selection}
              onChange={(e) => find(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <span className="goal-search-spinner" aria-hidden="true" />
            {selection && (
              <span className="goal-selected">
                <Cover
                  url={selection.cover_url}
                  name={selection.name}
                  className="goal-selected-cover"
                />
                <span className="goal-selected-text">
                  <b>{selection.name}</b>
                  {meta(selection) ? <small>{meta(selection)}</small> : null}
                </span>
                <button
                  type="button"
                  className="goal-selected-clear"
                  aria-label={t('add.changeLabel')}
                  data-tip={t('add.change')}
                  disabled={busy}
                  onClick={clearSelection}
                >
                  <Icon name="close" />
                </button>
              </span>
            )}
          </div>
          <button type="submit" className="sm" disabled={busy || !selection}>
            <Icon name="check" /> {t('add.save')}
          </button>
          <button
            type="button"
            className="ghost"
            id="goal-add-cancel"
            aria-label={t('add.cancel')}
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </form>
        {/* Mousedown on a result would blur the combobox, which handles the keys. */}
        <div
          ref={listbox}
          id="goal-search-results"
          role="listbox"
          aria-label={t('add.results')}
          aria-busy={searching}
          className={searching ? 'is-updating' : undefined}
          hidden={!shown}
          onMouseDown={(event) => event.preventDefault()}
        >
          {results === 'short' && <div className="goal-search-message">{t('add.short')}</div>}
          {results === 'skeleton' && (
            <div className="goal-search-skeleton" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <i />
                  <span>
                    <b />
                    <small />
                  </span>
                </div>
              ))}
            </div>
          )}
          {results === 'error' && (
            <div className="goal-search-message">
              {t('add.unavailable')}
              <small>{t('add.unavailableHint')}</small>
            </div>
          )}
          {results === 'options' &&
            (options.length ? (
              options.map((g, i) => {
                const saved = existing(g)
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: options are picked from the combobox input with the arrows and Enter (aria-activedescendant); focus stays in the input
                  <div
                    key={g.id}
                    role="option"
                    id={`goal-option-${i}`}
                    aria-selected={i === active}
                    aria-disabled={saved}
                    data-index={i}
                    onClick={() => select(i)}
                  >
                    <Cover url={g.cover_url} name={g.name} className="goal-search-cover" />
                    <span>
                      <b>{g.name}</b>
                      <small>{meta(g)}</small>
                    </span>
                    {saved ? <small>{t('add.saved')}</small> : <Icon name="plus" />}
                  </div>
                )
              })
            ) : (
              <div className="goal-search-message">
                <span className="goal-search-empty-icon">
                  <Icon name="search" />
                </span>
                <strong>{t('add.emptyTitle')}</strong>
                <small>{t('add.emptyHint')}</small>
              </div>
            ))}
        </div>
        <p
          id="goal-search-status"
          className={`goal-search-status${announce ? ' goal-search-announcement' : ''}`}
          role="status"
        >
          {status}
        </p>
        <button
          type="button"
          className="ghost"
          id="goal-search-retry"
          hidden={!retry}
          disabled={busy}
          onClick={() => find(draft)}
        >
          {t('add.retry')}
        </button>
      </div>
    </div>
  )
}
