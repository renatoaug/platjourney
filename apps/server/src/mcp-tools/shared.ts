/** What every MCP tool shares: the tool's shape, its errors, how a game is named in the arguments
 * and how games and trophies are written back to the assistant. */

import type { TitleProgress, TrophyStatus } from '../psn.ts'
import { loadGroups } from '../ranking.ts'
import type { AssistantKey } from '../repository/activity.ts'
import { type Game, gameByName, getGame } from '../repository/game.ts'
import type { User } from '../repository/user.ts'

export const MAX_TROPHIES = 300

/** A tool's failure the assistant should read and pass on (a game it did not find, a limit). */
export class ToolError extends Error {}

export type Args = Record<string, unknown>
/** Which assistant called: what the app shows next to what it saved. */
interface From {
  assistant: AssistantKey
}
export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  run: (user: User, args: Args, from?: From) => Promise<unknown>
  /** Changes the player's data: refused for the demo, which only reads. */
  changes?: boolean
  /** Takes something away (a saved game). */
  destructive?: boolean
  /** Added to the result as `next`: what to save when the assistant acts on it. An assistant that
   * loads tools as it needs them reads this, where it may never read the server's instructions. */
  next?: string
}

export const SAVE_PICK =
  'When you recommend one of these games to the player, save your main pick with save_suggestion (the game, why in two or three sentences about this player, and where to start).'

export const SAVE_LIST =
  "When you recommend a list of games from the player's taste, save it with save_recommendations (each game with why in two or three sentences about this player): their PlatJourney app shows it as your picks."

// What a reason for a game says, so an assistant's reads like Nexo's.
export const WHY =
  "in two or three sentences in the player's language: what they platinumed or played lately that leads here (with the hours), this game's time and difficulty from its guide, and how it fits their taste"

export const gameArg = {
  type: 'string',
  description: 'The game: its id from search_games ("game:1234") or its name.',
}

// A game by catalog id or by name; nothing is looked up outside the catalog.
export async function gameFrom(args: Args): Promise<Game> {
  const v = typeof args.game === 'string' ? args.game.trim() : ''
  const game = v.startsWith('game:') ? await getGame(v) : v ? await gameByName(v) : undefined
  if (!game) throw new ToolError(`No game found for "${v}". Try search_games first.`)
  return game
}

// The player's copy of a game with the most progress (PS5 over PS4 when equal).
export const ownCopy = (titles: TitleProgress[], game: Game) =>
  titles
    .filter((t) => game.np_communication_ids.includes(t.npCommunicationId))
    .sort((a, b) => b.progress - a.progress || (b.platform.includes('PS5') ? 1 : -1))[0]

export const trophyRow = (t: TrophyStatus) => ({
  name: t.nameEn || t.name,
  ...(t.name !== t.nameEn ? { localName: t.name } : {}),
  description: t.detailEn || t.detail,
  type: t.type,
  dlc: t.groupId !== 'default',
  earned: t.earned,
  ...(t.earnedAt ? { earnedAt: t.earnedAt } : {}),
  rarity: t.earnedRate,
  ...(t.progressTarget ? { progress: `${t.progressValue ?? 0}/${t.progressTarget}` } : {}),
})

export const gameRow = (g: Game) => ({
  id: g.id,
  name: g.name,
  platforms: g.platforms,
  releaseYear: g.release_year ?? null,
})

export async function baseProgress(title: TitleProgress, user: User) {
  const groups = await loadGroups(title, user).catch(() => null)
  return groups?.base.total
    ? { earned: groups.base.earned, total: groups.base.total }
    : { earned: title.earned, total: title.total }
}

export const limitOf = (args: Args, fallback: number, max: number) => {
  const n = Number(args.limit)
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}

export const hoursOf = (p?: { seconds: number }) =>
  p ? Math.round((p.seconds / 3600) * 10) / 10 : null

export const assistantOf = (from?: From): AssistantKey => from?.assistant ?? 'other'

// A required text argument, trimmed and cut to `max` characters.
export function textArg(args: Args, key: string, max: number): string {
  const v = typeof args[key] === 'string' ? (args[key] as string).trim() : ''
  if (!v) throw new ToolError(`"${key}" is required.`)
  return v.slice(0, max)
}

// A trimmed text argument cut to `max` characters, or `fallback` when missing or empty.
export const optText = <F>(v: unknown, max: number, fallback: F) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback
