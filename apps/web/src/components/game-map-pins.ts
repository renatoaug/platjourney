/** The pins of a game's map: HTML buttons kept in step with what the map's source has on screen.
 * Apart from the engine so it can be tested without WebGL; the engine places each one. */
import type { MapPoint } from './game-map'

/** What a placed marker must do: go away. */
export interface MarkerLike {
  remove: () => unknown
}

/** The part of the map the pins read: the spots its source has on screen now. */
export interface Spots {
  querySourceFeatures: (source: string) => {
    properties: unknown
    geometry: unknown
  }[]
}

type Entry = { marker: MarkerLike; el: HTMLButtonElement }

export type Shown = {
  points: MapPoint[]
  done: Set<string>
  selected: string | null
  icons: Record<string, string>
}

/** One pin: the category's icon from the page's sprite, like <Icon>; it lives outside React. */
export function pin(icon: string, label: string) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'map-pin'
  el.setAttribute('aria-label', label)
  el.innerHTML = `<span class="map-pin-head"><svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-${icon}"></use></svg></span>`
  return el
}

/** The spots the source has on screen now, by id. Only those get a pin: hundreds of HTML
 * markers across the whole world would make panning stutter. */
export function onScreen(m: Spots) {
  const want = new Map<string, [number, number]>()
  for (const f of m.querySourceFeatures('spots')) {
    const id = (f.properties as { id?: string }).id
    const at = (f.geometry as { coordinates?: [number, number] }).coordinates
    if (id && at) want.set(id, at)
  }
  return want
}

/** The HTML markers in step with the source: new ones added, gone ones removed, pins restyled. */
export function syncMarkers(
  m: Spots,
  markers: Map<string, Entry>,
  shown: Shown,
  on: {
    select: (id: string | null) => void
    place: (el: HTMLButtonElement, lngLat: [number, number]) => MarkerLike
  },
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
      const el = pin(
        shown.icons[point?.category ?? ''] ?? 'map',
        point?.title ?? point?.category ?? '',
      )
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        on.select(id)
      })
      entry = { marker: on.place(el, lngLat), el }
      markers.set(id, entry)
    }
    entry.el.classList.toggle('is-done', shown.done.has(id))
    entry.el.classList.toggle('is-approx', !!point?.approx)
    entry.el.classList.toggle('is-selected', shown.selected === id)
    entry.el.setAttribute('aria-pressed', String(shown.selected === id))
  }
}
