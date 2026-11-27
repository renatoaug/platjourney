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
            tileSize: 256,
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
      center: map.center,
      zoom: map.zoom,
      minZoom: map.minZoom,
      maxZoom: map.maxZoom,
      renderWorldCopies: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    })
    m.touchZoomRotate.disableRotation()
    m.on('click', () => select.current(null))
    engine.current = m
    return () => {
      m.remove()
      engine.current = null
      markers.current.clear()
    }
  }, [map])

  // Pins: add the new ones, drop the hidden ones, restyle all.
  useEffect(() => {
    const m = engine.current
    if (!m) return
    const want = new Set(points.map((p) => p.id))
    for (const [id, { marker }] of markers.current)
      if (!want.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    for (const p of points) {
      let entry = markers.current.get(p.id)
      if (!entry) {
        const el = pin(icons[p.category] ?? 'map', p.title ?? p.category)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          select.current(p.id)
        })
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.lng, p.lat])
          .addTo(m)
        entry = { marker, el }
        markers.current.set(p.id, entry)
      }
      entry.el.classList.toggle('is-done', done.has(p.id))
      entry.el.classList.toggle('is-approx', !!p.approx)
      entry.el.classList.toggle('is-selected', selected === p.id)
      entry.el.setAttribute('aria-pressed', String(selected === p.id))
    }
  }, [points, done, selected, icons])

  // The chosen spot comes into view above the card that covers the bottom of the map.
  useEffect(() => {
    const p = points.find((x) => x.id === selected)
    if (p && engine.current)
      engine.current.easeTo({ center: [p.lng, p.lat], offset: [0, -90], duration: 350 })
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
