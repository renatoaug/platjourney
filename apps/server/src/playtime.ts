import { isDemo } from './demo.ts'
import { normalizeName } from './igdb.ts'
import { library } from './library.ts'
import { playedGames } from './psn.ts'
import { catalogGameForName, gameForTitle, storeName } from './repository/game.ts'
import { listPlaytimes, type Playtime, savePlaytime } from './repository/playtime.ts'
import type { User } from './repository/user.ts'

const TTL_MS = 10 * 60_000
const cache = new Map<string, { at: number; byGame: Map<string, Playtime> }>()

// PSN reports playtime per store title (CUSA/PPSA), not per trophy list, so the
// link to the catalog is by name: first against the player's own trophy titles,
// then a catalog or IGDB game of that name. A name neither knows (an app, a store
// name in another language) is left out: playtime never adds a game to the catalog.
// Copies of the same game are summed.
async function sync(user: User): Promise<void> {
  const [played, titles] = await Promise.all([
    playedGames(user.psn_account_id),
    library(user.psn_account_id),
  ])
  const key = (name: string) => normalizeName(storeName(name))
  const byName = new Map(titles.map((t) => [key(t.name), t]))
  const totals = new Map<string, Playtime>()
  for (const p of played) {
    if (p.seconds <= 0) continue
    const title = byName.get(key(p.name))
    const game = title ? await gameForTitle(title) : await catalogGameForName(storeName(p.name))
    if (!game) continue
    const current = totals.get(game.id)
    totals.set(game.id, {
      game: game.id,
      seconds: (current?.seconds ?? 0) + p.seconds,
      play_count: (current?.play_count ?? 0) + p.playCount,
      first_played_at: [current?.first_played_at, p.firstPlayed].filter(Boolean).sort()[0] ?? null,
      last_played_at: [current?.last_played_at, p.lastPlayed].filter(Boolean).sort().at(-1) ?? null,
    })
  }
  for (const p of totals.values()) await savePlaytime(user.id, p)
}

// Playtime per catalog game id. What is stored is answered right away; the
// refresh from PSN (at most every 10 minutes) runs behind it, because the first
// one for a big library resolves hundreds of games and must not hold a page.
const syncing = new Set<string>()
export async function playtimes(user: User): Promise<Map<string, Playtime>> {
  // The demo player's hours are the stored ones; there is no PSN account to sync.
  if (isDemo(user)) return new Map((await listPlaytimes(user.id)).map((p) => [p.game, p]))
  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.at < TTL_MS) return cached.byGame
  if (!syncing.has(user.id)) {
    syncing.add(user.id)
    sync(user)
      .then(async () => {
        const fresh = new Map((await listPlaytimes(user.id)).map((p) => [p.game, p]))
        cache.set(user.id, { at: Date.now(), byGame: fresh })
      })
      .catch((e) => console.error('playtime sync failed:', (e as Error).message))
      .finally(() => syncing.delete(user.id))
  }
  return cached?.byGame ?? new Map((await listPlaytimes(user.id)).map((p) => [p.game, p]))
}

export const hours = (p?: Playtime) => (p ? Math.round((p.seconds / 3600) * 10) / 10 : null)
