import { ai } from './ai.ts'
import { config } from './config.ts'
import { tagged } from './costs.ts'
import type { Game } from './repository/game.ts'

// The deep guide: full guide pages split into passages and embedded, so Nexo
// can answer "where is collectible 37" from the source instead of from memory.
// The AI service finds, reads and indexes the pages in the background; this
// side asks for it and shows how far it got.

interface DeepGuideStats {
  chunks: number
  sources: { source: string; url: string }[]
  indexing: boolean
  indexedAt: string | null
}

interface GuidePage {
  url: string
  site: string
}

// Finds the full guides for a game, reads the pages it is allowed to, and indexes
// them; resolves when the index is done, and rejects with the reason when it failed.
// With `given`, the pages are already known (picked by hand or by a person
// researching the game) and the search step is skipped.
export function indexDeepGuide(
  game: Game,
  trophyTotal?: number,
  given?: GuidePage[],
): Promise<DeepGuideStats> {
  return tagged({ action: 'guide_index' }, () =>
    ai<DeepGuideStats>('/deep-guide/index', {
      game,
      trophyTotal: trophyTotal ?? null,
      pages: given ?? null,
      wait: true,
    }),
  )
}

// Indexes the first time, and again when the index is older than a month or the
// game's trophy list changed size. Returns at once; `indexing` says a job is running.
// Finding the pages takes a web search, so with automatic research off only
// indexDeepGuide with known pages builds one.
export async function ensureDeepGuide(
  game: Game,
  trophyTotal?: number,
): Promise<DeepGuideStats | null> {
  if (!config.automatic.research) return deepGuideStats(game)
  return tagged({ action: 'guide_index' }, () =>
    ai<DeepGuideStats>('/deep-guide/ensure', { game, trophyTotal: trophyTotal ?? null }),
  )
}

// Shown next to the guide; without the AI service the screen still loads, without it.
export function deepGuideStats(game: Game): Promise<DeepGuideStats | null> {
  return ai<DeepGuideStats>('/deep-guide/stats', { game }).catch((e) => {
    console.error('deep guide stats failed:', (e as Error).message)
    return null
  })
}
