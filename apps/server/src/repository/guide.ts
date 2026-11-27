import { camelKeys, one, plain, q, snakeKeys } from '../db.ts'
import { Language, type Locale } from '../i18n.ts'
import { gameRef } from './game.ts'

/** A game's guide in the reader's language: guide_en for English, guide_pt otherwise (and for
 * anything that matches trophies by name, which passes no language); the other one when that
 * language has none. Trophies match by their pt-BR or English name, so either guide works. */
export async function getGuide<T>(game: string, locale?: Locale): Promise<T | undefined> {
  const row = plain(
    await one<{ guide_pt?: T; guide_en?: T }>(
      'SELECT guide_pt, guide_en FROM guide WHERE game = $game LIMIT 1',
      { game: gameRef(game) },
    ),
  )
  const read =
    locale === Language.En ? (row?.guide_en ?? row?.guide_pt) : (row?.guide_pt ?? row?.guide_en)
  return read ? camelKeys(read) : undefined
}

/** Saves a guide in one language. The other one, when there is one, is left as it was and marked
 * outdated until it is translated again: no text is ever dropped. */
export async function saveGuide(game: string, guide: unknown, locale: Locale = Language.PtBR) {
  const [field, other] = locale === Language.En ? ['guide_en', 'pt-BR'] : ['guide_pt', 'en']
  const otherField = field === 'guide_en' ? 'guide_pt' : 'guide_en'
  await q(
    `UPSERT guide SET game = $game, ${field} = $guide, fetched_at = time::now(),
       outdated = IF ${otherField} != NONE { $other } ELSE { NONE } WHERE game = $game`,
    { game: gameRef(game), guide: snakeKeys(guide), other },
  )
}

export interface GuideSummary {
  game: string
  difficulty: number
  hours: number
  playthroughs: number
  hasMissables: boolean
  hasOnline: boolean
  unobtainable: string | null
  deep: boolean
}

// The quick facts of every stored guide, to list and sort games by them.
export async function guideSummaries(): Promise<GuideSummary[]> {
  return plain(
    await q<GuideSummary[]>(
      `SELECT game, g.difficulty AS difficulty, g.hours AS hours, g.playthroughs AS playthroughs,
         g.has_missables AS has_missables, g.has_online AS has_online,
         g.unobtainable AS unobtainable, passages > 0 AS deep
       FROM (SELECT game, passages, guide_pt ?? guide_en AS g FROM guide) WHERE g != NONE`,
    ),
  ).map(camelKeys)
}
