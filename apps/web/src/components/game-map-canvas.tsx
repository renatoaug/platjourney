/** The map engine (MapLibre) with the game's tiles and its pins. Loaded on demand by game-map.tsx:
 * the engine is heavy and only this page needs it. The CSP build runs its worker from our own
 * origin, so the page's policy needs no blob: scripts. */
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { GameMapData, MapPoint } from './game-map'

maplibregl.setWorkerUrl(workerUrl)

// The token behind each kind of map, where its picture ends.
const BACKGROUND = { water: '--color-map-water', paper: '--color-map-paper', dark: '--color-bg' }

// Room for the filters along the top and the zoom buttons on the right.
const FIT_PADDING = { top: 100, bottom: 16, left: 60, right: 60 }

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function pin(icon: string, label: string) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'map-pin'
  el.setAttribute('aria-label', label)
  // The sprite's symbol, like <Icon>; the marker lives outside React.
  el.innerHTML = `<span class="map-pin-head"><svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${icon}"></use></svg></span>`
  return el
}

type Entry = { marker: maplibregl.Marker; el: HTMLButtonElement }
type Shown = {
  points: MapPoint[]
  done: Set<string>
  selected: string | null
  icons: Record<string, string>
}

/** The spots the source has on screen now, by id. Only those get a pin: hundreds of HTML
 * markers across the whole world would make panning stutter. */
function onScreen(m: maplibregl.Map) {
  const want = new Map<string, [number, number]>()
  for (const f of m.querySourceFeatures('spots')) {
    const id = (f.properties as { id?: string }).id
    if (id) want.set(id, (f.geometry as GeoJSON.Point).coordinates as [number, number])
  }
  return want
}

function element(
  m: maplibregl.Map,
  id: string,
  lngLat: [number, number],
  point: MapPoint | undefined,
  icons: Record<string, string>,
  select: (id: string | null) => void,
): Entry {
  const el = pin(icons[point?.category ?? ''] ?? 'map', point?.title ?? point?.category ?? '')
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    select(id)
  })
  const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(m)
  return { marker, el }
}

/** The HTML markers in step with the source: new ones added, gone ones removed, pins restyled. */
function syncMarkers(
  m: maplibregl.Map,
  markers: Map<string, Entry>,
  shown: Shown,
  select: (id: string | null) => void,
) {
  const byId = new Map(shown.points.map((p) => [p.id, p]))
  const want = onScreen(m)
  for (const [id, { marker }] of markers)
    if (!want.has(id)) {
      marker.remove()
      markers.delete(id)
    }
  for (const [id, lngLat] of want) {
    const point = byId.get(id)
    let entry = markers.get(id)
    if (!entry) {
      entry = element(m, id, lngLat, point, shown.icons, select)
      markers.set(id, entry)
    }
    entry.el.classList.toggle('is-done', shown.done.has(id))
    entry.el.classList.toggle('is-approx', !!point?.approx)
    entry.el.classList.toggle('is-selected', shown.selected === id)
    entry.el.setAttribute('aria-pressed', String(shown.selected === id))
  }
}

export default function GameMapCanvas({
  game,
  map,
  points,
  icons,
  done,
  selected,
  onSelect,
  labels,
}: {
  /** The catalog id (game:25076) whose tiles to show. */
  game: string
  map: GameMapData
  points: MapPoint[]
  icons: Record<string, string>
  done: Set<string>
  selected: string | null
  onSelect: (id: string | null) => void
  labels: { zoomIn: string; zoomOut: string }
}) {
  const box = useRef<HTMLDivElement>(null)
  const engine = useRef<maplibregl.Map | null>(null)
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLButtonElement }>())

  // The latest handler, read by the map's own click listener, which is set up once.
  const select = useRef(onSelect)
  select.current = onSelect

  // The map is built once per game; the points and the selection update it below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuilding on every render would reset the view
  useEffect(() => {
    if (!box.current) return
    const m = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          game: {
            type: 'raster',
            tiles: [
              `${location.origin}/api/game-map/tile?game=${encodeURIComponent(game)}&v=${map.version ?? 1}&z={z}&x={x}&y={y}`,
            ],
            // On a dense screen each tile covers half the space, so the map loads one level
            // sharper instead of enlarging blurry tiles.
            tileSize: window.devicePixelRatio > 1 ? 128 : 256,
            maxzoom: map.tileMaxZoom,
          },
        },
        layers: [
          {
            id: 'bg',
            type: 'background',
            paint: {
              'background-color': css(BACKGROUND[map.background]),
            },
          },
          { id: 'game', type: 'raster', source: 'game', paint: { 'raster-fade-duration': 150 } },
        ],
      },
      // The whole world in view, clear of the filters on top; without bounds, the saved view.
      ...(map.bounds
        ? {
            bounds: map.bounds,
            fitBoundsOptions: { padding: FIT_PADDING },
          }
        : { center: map.center, zoom: map.zoom }),
      minZoom: map.minZoom,
      maxZoom: map.maxZoom,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    })
    m.touchZoomRotate.disableRotation()
    // The box may not have its final size when the map is made (the page still laying out), and
    // a fit that does not fit falls back to the world's middle: fit again once it has loaded.
    if (map.bounds) {
      const bounds = map.bounds
      m.once('load', () => {
        m.resize()
        m.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 })
      })
    }
    m.on('click', () => select.current(null))
    engine.current = m
    return () => {
      m.remove()
      engine.current = null
      markers.current.clear()
    }
  }, [map])

  // The latest of what the pins show, read when the map moves (the sync below runs outside React).
  const state = useRef({ points, done, selected, icons })
  state.current = { points, done, selected, icons }

  // The pins follow the source; the sync runs outside React, on the map's own events.
  const sync = useRef(() => {})
  sync.current = () => {
    const m = engine.current
    if (!m?.getSource('spots') || !m.isSourceLoaded('spots')) return
    syncMarkers(m, markers.current, state.current, (id) => select.current(id))
  }

  // The spots as a source, kept in step with the filters.
  useEffect(() => {
    const m = engine.current
    if (!m) return
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id },
      })),
    }
    const apply = () => {
      const src = m.getSource('spots') as maplibregl.GeoJSONSource | undefined
      if (src) src.setData(data)
      else {
        m.addSource('spots', { type: 'geojson', data })
        // An invisible layer: the source only computes what is on screen while a layer uses it.
        m.addLayer({
          id: 'spots',
          type: 'circle',
          source: 'spots',
          paint: { 'circle-opacity': 0, 'circle-radius': 1 },
        })
        m.on('sourcedata', (e) => e.sourceId === 'spots' && sync.current())
        m.on('moveend', () => sync.current())
      }
      // A new filter: the old pins go, the engine builds the new ones.
      for (const { marker } of markers.current.values()) marker.remove()
      markers.current.clear()
    }
    if (m.isStyleLoaded()) apply()
    else m.once('load', apply)
  }, [points])

  // Collected and chosen pins change their look in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are what the sync reads
  useEffect(() => {
    sync.current()
  }, [done, selected])

  // The chosen spot comes into view above the card that covers the bottom of the map.
  useEffect(() => {
    const p = points.find((x) => x.id === selected)
    if (p && engine.current)
      engine.current.easeTo({ center: [p.lng, p.lat], offset: [0, -60], duration: 350 })
  }, [selected, points])

  return (
    <>
      <div ref={box} className="game-map-canvas" />
      <div className="game-map-zoom">
        <button type="button" aria-label={labels.zoomIn} onClick={() => engine.current?.zoomIn()}>
          <svg className="icon" aria-hidden="true" focusable="false">
            <use href="#icon-plus" />
          </svg>
        </button>
        <button type="button" aria-label={labels.zoomOut} onClick={() => engine.current?.zoomOut()}>
          <svg className="icon" aria-hidden="true" focusable="false">
            <use href="#icon-minus" />
          </svg>
        </button>
      </div>
    </>
  )
}
