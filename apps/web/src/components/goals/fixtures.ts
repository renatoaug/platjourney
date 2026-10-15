/** Sample interests, platinums and catalog answers for the goals stories. No covers: stories stay off the network. */
import type { Game, Interest, YearGoals } from '../../lib/types'

const game = (slug: string, name: string, extra: Partial<Game> = {}): Game => ({
  id: `game:${slug}`,
  name,
  platforms: ['PS5'],
  release_year: 2020,
  ...extra,
})

const NAMES = [
  'Ghost of Tsushima',
  'Astro Bot',
  'Spider-Man 2',
  'Ratchet & Clank: Rift Apart',
  'Returnal',
  'Horizon Forbidden West',
  'God of War Ragnarök',
  'Stray',
  'Hades',
  'Celeste',
  'Hollow Knight',
  'Sekiro',
]

const sampleInterests: Interest[] = [
  ...NAMES.map((name, i) => ({
    id: `interest:${i}`,
    game: game(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name),
    position: i,
    // The server sends null for a game never started.
    progress: (i % 3 === 0 ? null : (i * 17) % 95) as number,
    hours: i % 3 === 0 ? undefined : 4 + i * 3.5,
    done: false,
  })),
  {
    id: 'interest:done-1',
    game: game('days-gone', 'DAYS GONE'),
    position: 99,
    progress: 100,
    hours: 61,
    done: true,
  },
]

export const sampleGoals: YearGoals = {
  year: 2026,
  target: 12,
  done: 7,
  interests: sampleInterests,
  platinumed: [
    ['days-gone', 'DAYS GONE', '2026-09-12', 61],
    ['stray', 'Stray', '2026-08-30', 9],
    ['astro-playroom', "Astro's Playroom", '2026-08-02', 7.5],
    ['spider-man', 'Marvel’s Spider-Man', '2026-06-18', 34],
    ['the-last-of-us', 'The Last of Us Part I', '2026-04-05', 28],
    ['uncharted-4', 'Uncharted 4', '2026-02-20', 22],
    ['inside', 'Inside', '2026-01-09', undefined],
  ].map(([slug, name, at, hours]) => ({
    game: game(String(slug), String(name)),
    at: String(at),
    hours: hours as number | undefined,
  })),
}

export const emptyGoals: YearGoals = {
  year: 2026,
  target: 0,
  done: 0,
  interests: [],
  platinumed: [],
}

const CATALOG = [
  game('elden-ring', 'Elden Ring', { release_year: 2022, platforms: ['PS5', 'PS4'] }),
  game('elden-ring-nightreign', 'Elden Ring Nightreign', { release_year: 2025 }),
  game('ghost-of-tsushima', 'Ghost of Tsushima', { release_year: 2020 }),
  game('ghost-of-yotei', 'Ghost of Yōtei', { release_year: 2025 }),
  game('bloodborne', 'Bloodborne', { release_year: 2015, platforms: ['PS4'] }),
]

/** Catalog search over the sample games, with the server's latency. */
export const fakeSearch = (query: string) =>
  new Promise<Game[]>((resolve) =>
    setTimeout(
      () =>
        resolve(
          CATALOG.filter((g) =>
            query
              .toLowerCase()
              .split(' ')
              .every((word) => g.name.toLowerCase().includes(word)),
          ),
        ),
      500,
    ),
  )

export const failingSearch = () =>
  new Promise<Game[]>((_, reject) => setTimeout(() => reject(new Error('offline')), 500))

/** A stand-in for POST /api/goals over the sample state, so the stories can add, remove, reorder and set. */
export function applyCommand(p: YearGoals, text: string): YearGoals {
  const [verb, arg = ''] = [text.slice(0, text.indexOf(' ')), text.slice(text.indexOf(' ') + 1)]
  if (verb === 'set') return { ...p, target: Number(arg) }
  if (verb === 'remove') return { ...p, interests: p.interests.filter((g) => g.id !== arg) }
  if (verb === 'order') {
    const ids = arg.split(',')
    const rank = (g: Interest) => (ids.includes(g.id) ? ids.indexOf(g.id) : ids.length)
    return { ...p, interests: [...p.interests].sort((a, b) => rank(a) - rank(b)) }
  }
  if (verb === 'add') {
    const found = CATALOG.find((g) => g.id === arg) ?? game(arg.slice(5), arg.slice(5))
    const item: Interest = {
      id: `interest:${Date.now()}`,
      game: found,
      position: 0,
      progress: null,
      done: false,
    }
    return { ...p, interests: [item, ...p.interests] }
  }
  return p
}
