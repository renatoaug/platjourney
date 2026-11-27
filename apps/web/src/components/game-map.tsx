/** A game's interactive map: what there is to collect and where, over the game's own map. The
 * map engine loads only with this page (game-map-canvas.tsx); the points come from the server. */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'
import './game-map.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Mapa',
    lead: '{count, plural, one {# ponto} other {# pontos}} para coletar',
    categories: 'O que mostrar',
    all: 'Tudo',
    missing: 'Só o que falta',
    collected: 'Coletado',
    collect: 'Marcar como coletado',
    uncollect: 'Desmarcar',
    close: 'Fechar',
    approx: 'Posição aproximada: o centro do bairro.',
    zoomIn: 'Aproximar',
    zoomOut: 'Afastar',
    progress: '{done} de {total} coletados',
    none: 'Este jogo ainda não tem mapa.',
    noneFiltered: 'Nada para mostrar com esses filtros.',
    failed: 'Não deu para abrir o mapa agora.',
    retry: 'Tentar de novo',
    credit: 'Créditos do mapa',
  },
  [Language.En]: {
    title: 'Map',
    lead: '{count, plural, one {# spot} other {# spots}} to collect',
    categories: 'What to show',
    all: 'All',
    missing: 'Only what is left',
    collected: 'Collected',
    collect: 'Mark as collected',
    uncollect: 'Unmark',
    close: 'Close',
    approx: 'Approximate spot: the middle of the district.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    progress: '{done} of {total} collected',
    none: 'This game has no map yet.',
    noneFiltered: 'Nothing to show with these filters.',
    failed: 'The map could not open right now.',
    retry: 'Try again',
    credit: 'Map credits',
  },
})

export interface MapCategory {
  id: string
  name: Record<string, string>
  icon: string
}

export interface MapPoint {
  id: string
  category: string
  lng: number
  lat: number
  title?: string
  detail?: string | Record<string, string>
  approx?: boolean
}

export interface GameMapData {
  background: 'water' | 'paper' | 'dark'
  minZoom: number
  maxZoom: number
  version?: number
  tileMaxZoom: number
  center: [number, number]
  bounds?: [number, number, number, number]
  zoom: number
  attribution: string
  tiles?: string
  categories: MapCategory[]
  points: MapPoint[]
}

type Loaded =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'error' }
  | { state: 'ready'; map: GameMapData }

/** The game's map, or that it has none. A game without one gets no map page or card. */
export function useGameMap(game: string | undefined) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // A retry runs it again for the same game.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt only re-runs it
  useEffect(() => {
    if (!game) return setLoaded({ state: 'none' })
    let live = true
    setLoaded({ state: 'loading' })
    api<GameMapData>(`/api/game-map?game=${encodeURIComponent(game)}`)
      .then((map) => live && setLoaded({ state: 'ready', map }))
      .catch(
        (e: { status?: number }) =>
          live && setLoaded({ state: e.status === 404 ? 'none' : 'error' }),
      )
    return () => {
      live = false
    }
  }, [game, attempt])
  return { loaded, retry: () => setAttempt((n) => n + 1) }
}

const categoryName = (c: MapCategory) => c.name[getLocale()] ?? c.name[Language.PtBR] ?? c.id

/** A spot's text in the page's language, else pt-BR, else the one text it has. */
const inLanguage = (text: string | Record<string, string> | undefined) =>
  typeof text === 'string' ? text : text ? (text[getLocale()] ?? text[Language.PtBR]) : undefined

// What the player marked as collected goes with the account. Someone without one (the public
// game page) keeps the marks on this device.
const collectedKey = (game: string) => `pj-map-collected:${game}`
const readLocal = (game: string) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(collectedKey(game)) ?? '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

function useCollected(game: string, signedIn: boolean) {
  const [done, setDone] = useState<Set<string>>(() => (signedIn ? new Set() : readLocal(game)))
  useEffect(() => {
    if (!signedIn) return
    let live = true
    api<{ spots: string[] }>(`/api/game-map/collected?game=${encodeURIComponent(game)}`)
      .then((r) => live && setDone(new Set(r.spots)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [game, signedIn])
  const toggle = (id: string) => {
    const collected = !done.has(id)
    // The mark shows at once; the server's answer then holds every spot, from any device.
    setDone((prev) => {
      const next = new Set(prev)
      if (collected) next.add(id)
      else next.delete(id)
      if (!signedIn)
        try {
          localStorage.setItem(collectedKey(game), JSON.stringify([...next]))
        } catch {}
      return next
    })
    if (signedIn)
      api<{ spots: string[] }>('/api/game-map/collected', { game, spot: id, collected })
        .then((r) => setDone(new Set(r.spots)))
        .catch(() =>
          setDone((prev) => {
            const back = new Set(prev)
            if (collected) back.delete(id)
            else back.add(id)
            return back
          }),
        )
  }
  return { done, toggle }
}

const MapCanvas = lazy(() => import('./game-map-canvas'))

/** The map page: the request, then the map. */
export function GameMap({ game }: { game: string }) {
  const t = useMessages(messages)
  const { loaded, retry } = useGameMap(game)
  if (loaded.state === 'loading') return <GameMapSkeleton />
  if (loaded.state === 'none') return <EmptyState icon="map">{t('none')}</EmptyState>
  if (loaded.state === 'error')
    return (
      <ErrorState
        icon="map"
        action={
          <button type="button" onClick={retry}>
            {t('retry')}
          </button>
        }
      >
        {t('failed')}
      </ErrorState>
    )
  return <GameMapView game={game} map={loaded.map} />
}

/** The map with its filters and the card of the chosen spot; takes the data as it is. */
export function GameMapView({ game, map }: { game: string; map: GameMapData }) {
  const t = useMessages(messages)
  const signedIn = useApp().me.visitor !== true
  const { done, toggle } = useCollected(game, signedIn)
  // One category at a time; null shows them all.
  const [only, setOnly] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [credit, setCredit] = useState(false)
  const icons = useMemo(() => Object.fromEntries(map.categories.map((c) => [c.id, c.icon])), [map])
  const shown = useMemo(
    () => map.points.filter((p) => (!only || p.category === only) && !(missing && done.has(p.id))),
    [map, only, missing, done],
  )
  const point = map.points.find((p) => p.id === selected) ?? null
  const category = point ? map.categories.find((c) => c.id === point.category) : undefined
  return (
    <section className={`game-map is-${map.background}`} aria-label={t('title')}>
      <Suspense fallback={<div className="game-map-canvas" aria-busy="true" />}>
        <MapCanvas
          game={game}
          map={map}
          points={shown}
          icons={icons}
          done={done}
          selected={selected}
          onSelect={setSelected}
          labels={{ zoomIn: t('zoomIn'), zoomOut: t('zoomOut') }}
        />
      </Suspense>
      <div className="game-map-top">
        <div className="game-map-progress">
          <Icon name="map" />
          <span>
            {t('progress', {
              done: map.points.filter((p) => done.has(p.id)).length,
              total: map.points.length,
            })}
          </span>
        </div>
        <fieldset className="game-map-chips">
          <legend className="sr-only">{t('categories')}</legend>
          <button
            type="button"
            className="chip"
            aria-pressed={missing}
            onClick={() => setMissing((m) => !m)}
          >
            <Icon name="check" /> {t('missing')}
          </button>
          <span className="game-map-chips-gap" aria-hidden="true" />
          <button type="button" className="chip" aria-pressed={!only} onClick={() => setOnly(null)}>
            {t('all')}
            <small>{map.points.length}</small>
          </button>
          {map.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={only === c.id}
              onClick={() => setOnly(only === c.id ? null : c.id)}
            >
              <Icon name={c.icon} /> {categoryName(c)}
              <small>{map.points.filter((p) => p.category === c.id).length}</small>
            </button>
          ))}
        </fieldset>
      </div>
      {!shown.length && <p className="game-map-filtered">{t('noneFiltered')}</p>}
      {point && (
        <article className="card game-map-spot">
          <span className="game-map-spot-icon">
            <Icon name={category?.icon ?? 'map'} />
          </span>
          <div className="game-map-spot-copy">
            {/* A spot without a name of its own is named by its category, said once. */}
            {point.title && <small>{category ? categoryName(category) : ''}</small>}
            <b>{point.title ?? (category ? categoryName(category) : '')}</b>
            {inLanguage(point.detail) && <p>{inLanguage(point.detail)}</p>}
            {point.approx && <p className="game-map-spot-approx">{t('approx')}</p>}
          </div>
          <button
            type="button"
            className="game-map-close"
            aria-label={t('close')}
            onClick={() => setSelected(null)}
          >
            <Icon name="close" />
          </button>
          <button
            type="button"
            className={`game-map-collect${done.has(point.id) ? ' ghost' : ''}`}
            onClick={() => toggle(point.id)}
          >
            <Icon name="check" /> {done.has(point.id) ? t('uncollect') : t('collect')}
          </button>
        </article>
      )}
      {/* Only a map whose license asks for credit carries one, behind an info button. */}
      {map.attribution && (
        <div className="game-map-credit">
          <button
            type="button"
            aria-label={t('credit')}
            aria-expanded={credit}
            onClick={() => setCredit((c) => !c)}
          >
            <Icon name="info" />
          </button>
          {credit && <p>{map.attribution}</p>}
        </div>
      )}
    </section>
  )
}

/** The map's shape while it loads: the filter row over a blank map. */
export function GameMapSkeleton() {
  return (
    <section className="game-map" aria-busy="true">
      <div className="game-map-canvas" />
      <div className="game-map-top">
        <Sk w="140px" h={14} />
        <div className="game-map-chips">
          <Sk w="110px" h={32} />
          <Sk w="150px" h={32} />
          <Sk w="130px" h={32} />
        </div>
      </div>
    </section>
  )
}
