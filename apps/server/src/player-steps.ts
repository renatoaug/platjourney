/**
 * Players' unlock times, kept as they arrive from PSN and read back to say where long trophies
 * usually close (ADR-015). Nothing here blocks a page: a failed write or read only leaves the
 * guide as it was.
 */
import { closingSteps, type PlacedGuide } from '../../../shared/journey/places.ts'
import { ai } from './ai.ts'
import { currentTag, tagged } from './costs.ts'
import type { TrophyStatus } from './psn.ts'
import type { Game } from './repository/game.ts'
import { saveUnlocks, unlocksOn } from './repository/unlock.ts'

// What was already written for a player's list: a page load with nothing new writes nothing.
const saved = new Map<string, number>()

export function keepUnlocks(user: string, np: string, trophies: TrophyStatus[]) {
  const earned = trophies.flatMap((t) =>
    t.earned && t.earnedAt ? [{ id: t.id, earnedAt: t.earnedAt }] : [],
  )
  const key = `${user}|${np}`
  if (!earned.length || saved.get(key) === earned.length) return
  if (saved.size > 20_000) saved.clear()
  saved.set(key, earned.length)
  saveUnlocks(user, np, earned).catch((e) => {
    saved.delete(key)
    console.error('unlocks not kept:', (e as Error).message)
  })
}

// Read back once an hour per list: steps move slowly, as players earn trophies.
const steps = new Map<
  string,
  { at: number; unlocks: Promise<Awaited<ReturnType<typeof unlocksOn>>> }
>()
const TTL = 60 * 60_000

// Asked once an hour per game at most: the AI service stores the answer with the guide, and a guide
// saved again drops it.
const predicting = new Map<string, number>()

/**
 * Asks the AI service, in the background, where each trophy without a single moment probably falls
 * (ADR-017). The answer reaches the next page load; nothing waits for it.
 */
function predictSteps(
  game: Game | null | undefined,
  guide: PlacedGuide | null | undefined,
  trophies: TrophyStatus[] | null | undefined,
) {
  if (!game || !guide?.storyline || !guide.trophyPlaces?.length || !trophies?.length) return
  if (guide.predictedSteps || currentTag().demo) return
  const last = predicting.get(game.id)
  if (last && Date.now() - last < TTL) return
  if (predicting.size > 5_000) predicting.clear()
  predicting.set(game.id, Date.now())
  tagged({ action: 'guide_steps' }, () => ai('/guides/predict-steps', { game, trophies })).catch(
    (e) => console.error('predicted steps failed:', (e as Error).message),
  )
}

/** The guide with where its long trophies usually close, from the players of this PSN list. */
export async function withPlayerSteps<G extends PlacedGuide>(
  guide: G | null | undefined,
  trophies: TrophyStatus[] | null | undefined,
  np: string | null | undefined,
  game?: Game | null,
): Promise<G | null | undefined> {
  predictSteps(game, guide, trophies)
  if (!guide?.trophyPlaces?.length || !trophies?.length || !np) return guide
  let entry = steps.get(np)
  if (!entry || Date.now() - entry.at > TTL) {
    if (steps.size > 5_000) steps.clear()
    entry = { at: Date.now(), unlocks: unlocksOn(np) }
    steps.set(np, entry)
    entry.unlocks.catch(() => steps.delete(np))
  }
  const unlocks = await entry.unlocks.catch(() => [])
  const found = closingSteps(trophies, unlocks, guide)
  return found.length ? { ...guide, trophySteps: found } : guide
}
