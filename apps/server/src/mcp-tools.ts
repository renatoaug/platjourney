/** What a connected assistant can do through MCP (mcp.ts): read the player's profile, library,
 * trophies, current game, interests, platinums and the guides, see what PlatJourney ranks and
 * recommends without the model, and change the interests, the yearly goal and the recommendations.
 * A tool returns facts; the assistant writes the answer. */
import { ai } from './ai.ts'
import { browseGuides } from './browse.ts'
import { tagged } from './costs.ts'
import { isDemo, storedSummary, trophiesFor } from './demo.ts'
import { handleInterestCommand, yearProgress } from './interests.ts'
import { library, ownedGames } from './library.ts'
import type { PlanStep, SessionPlan } from './planner.ts'
import { playtimes } from './playtime.ts'
import { profilePage } from './profile.ts'
import { catalogTrophies, profileSummary, type TitleProgress, type TrophyStatus } from './psn.ts'
import { loadGroups, rankNextPlatinum } from './ranking.ts'
import { dismissRecommendation } from './recommend.ts'
import { RELEASES_AFTER_DAYS, RELEASES_BEFORE_DAYS } from './releases.ts'
import { type AssistantKey, logAssistantTip } from './repository/activity.ts'
import {
  type Game,
  gameByName,
  gamesForTitles,
  getGame,
  releasesBetween,
} from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import { listInterests } from './repository/interest.ts'
import { isDismissReason, saveAssistantPick } from './repository/recommendation.ts'
import { guideFacts } from './repository/similar.ts'
import { type User, updateUser } from './repository/user.ts'
import { similarPicks, similarToGame } from './similar.ts'
import { demoContext, getCurrent } from './watcher.ts'

const MAX_TROPHIES = 300

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

const SAVE_PICK =
  'When you recommend one of these games to the player, save your pick with save_suggestion (the game and why, in one sentence).'

const gameArg = {
  type: 'string',
  description: 'The game: its id from search_games ("game:1234") or its name.',
}

// A game by catalog id or by name; nothing is looked up outside the catalog.
async function gameFrom(args: Args): Promise<Game> {
  const v = typeof args.game === 'string' ? args.game.trim() : ''
  const game = v.startsWith('game:') ? await getGame(v) : v ? await gameByName(v) : undefined
  if (!game) throw new ToolError(`No game found for "${v}". Try search_games first.`)
  return game
}

// The player's copy of a game with the most progress (PS5 over PS4 when equal).
const ownCopy = (titles: TitleProgress[], game: Game) =>
  titles
    .filter((t) => game.np_communication_ids.includes(t.npCommunicationId))
    .sort((a, b) => b.progress - a.progress || (b.platform.includes('PS5') ? 1 : -1))[0]

const trophyRow = (t: TrophyStatus) => ({
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

const gameRow = (g: Game) => ({
  id: g.id,
  name: g.name,
  platforms: g.platforms,
  releaseYear: g.release_year ?? null,
})

async function baseProgress(title: TitleProgress, user: User) {
  const groups = await loadGroups(title, user).catch(() => null)
  return groups?.base.total
    ? { earned: groups.base.earned, total: groups.base.total }
    : { earned: title.earned, total: title.total }
}

const limitOf = (args: Args, fallback: number, max: number) => {
  const n = Number(args.limit)
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}

const hoursOf = (p?: { seconds: number }) => (p ? Math.round((p.seconds / 3600) * 10) / 10 : null)

// The interest holding a game this year, for the tools that change one.
async function savedInterest(user: User, game: Game) {
  const found = (await listInterests(user.id, new Date().getFullYear())).find(
    (i) => i.game.id === game.id,
  )
  if (!found) throw new ToolError(`${game.name} is not in the interests. See get_interests.`)
  return found
}

// The same commands the web and Telegram run; one that answers its usage text was refused.
async function interestCommand(user: User, command: string) {
  await handleInterestCommand(user, command, await library(user.psn_account_id))
}

const assistantOf = (from?: From): AssistantKey => from?.assistant ?? 'other'

// A required text argument, trimmed and cut to `max` characters.
function textArg(args: Args, key: string, max: number): string {
  const v = typeof args[key] === 'string' ? (args[key] as string).trim() : ''
  if (!v) throw new ToolError(`"${key}" is required.`)
  return v.slice(0, max)
}

const plainName = (s: string) => s.trim().toLowerCase()

// A trimmed text argument cut to `max` characters, or `fallback` when missing or empty.
const optText = <F>(v: unknown, max: number, fallback: F) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback

// The game's trophies by name, local and English, without the platinum (never a step).
function trophyIndex(trophies: TrophyStatus[]) {
  const byName = new Map<string, TrophyStatus>()
  for (const t of trophies.filter((x) => x.type !== 'platinum'))
    for (const n of [t.name, t.nameEn].filter(Boolean)) byName.set(plainName(n), t)
  return byName
}

function planStep(step: Args, trophy: TrophyStatus): PlanStep {
  const minutes = Math.round(Number(step.minutes))
  return {
    trophy: trophy.name,
    minutes: minutes > 0 ? Math.min(minutes, 600) : 15,
    how: optText(step.how, 600, ''),
    why: optText(step.why, 300, ''),
    trick: optText(step.trick, 300, null),
    flexible: step.flexible === true,
  }
}

// The assistant's steps on the trophies of the game being played, each named as the trophy list
// names it (so it ticks itself off when PSN reports it); steps on no trophy of the game are left
// out and reported.
function planSteps(raw: unknown, trophies: TrophyStatus[]) {
  const byName = trophyIndex(trophies)
  const steps: PlanStep[] = []
  const unknown: string[] = []
  for (const s of Array.isArray(raw) ? raw.slice(0, 20) : []) {
    const step = (s ?? {}) as Args
    const name = typeof step.trophy === 'string' ? step.trophy : ''
    const trophy = byName.get(plainName(name))
    if (trophy) steps.push(planStep(step, trophy))
    else if (name) unknown.push(name)
  }
  return { steps, unknown }
}

export const TOOLS: Tool[] = [
  {
    name: 'get_profile',
    description:
      "The player's PlayStation trophy profile: PSN ID, trophy level and trophies earned by type.",
    inputSchema: { type: 'object', properties: {} },
    run: async (user) => {
      const titles = await library(user.psn_account_id)
      const s = isDemo(user)
        ? storedSummary(user, titles)
        : await profileSummary(user.psn_account_id, user.psn_online_id)
      return {
        onlineId: s.onlineId,
        level: s.level,
        levelProgress: s.levelProgress,
        earned: s.earned,
        games: titles.length,
      }
    },
  },
  {
    name: 'get_current_game',
    description:
      'The game the player is playing now (from PSN): progress toward the platinum, hours played and the base-game trophies still missing.',
    inputSchema: { type: 'object', properties: {} },
    next: 'If you plan a session for this game, save the plan with save_session_plan.',
    run: async (user) => {
      const ctx = getCurrent(user) ?? (isDemo(user) ? await demoContext(user) : undefined)
      if (!ctx) return { playing: null }
      const base = await baseProgress(ctx.title, user)
      return {
        playing: {
          game: gameRow(ctx.game),
          platform: ctx.title.platform,
          progress: ctx.title.progress,
          baseGame: base,
          hoursPlayed: ctx.hoursPlayed ?? null,
          hasGuide: !!ctx.guide,
          missing: ctx.trophies
            .filter((t) => !t.earned && t.groupId === 'default')
            .slice(0, MAX_TROPHIES)
            .map(trophyRow),
        },
      }
    },
  },
  {
    name: 'get_trophies',
    description:
      "A game's trophy list. For a game the player owns, each trophy says whether they earned it.",
    inputSchema: {
      type: 'object',
      properties: {
        game: gameArg,
        status: {
          type: 'string',
          enum: ['all', 'earned', 'missing'],
          description: 'Which trophies to list (default all).',
        },
      },
      required: ['game'],
    },
    run: async (user, args) => {
      const game = await gameFrom(args)
      const title = ownCopy(await library(user.psn_account_id), game)
      const list = title
        ? await trophiesFor(title, user)
        : isDemo(user)
          ? []
          : ((await catalogTrophies(game.np_communication_ids))?.trophies ?? [])
      const status = args.status
      const shown = list.filter((t) =>
        status === 'earned' ? t.earned : status === 'missing' ? !t.earned : true,
      )
      return {
        game: gameRow(game),
        owned: !!title,
        ...(title
          ? {
              platform: title.platform,
              progress: title.progress,
              baseGame: await baseProgress(title, user),
            }
          : {}),
        trophies: shown.slice(0, MAX_TROPHIES).map(trophyRow),
      }
    },
  },
  {
    name: 'search_games',
    description:
      'Finds games in the PlatJourney catalog by name, with whether each has a platinum guide and its difficulty and hours.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Part of the game name.' } },
      required: ['query'],
    },
    run: async (_user, args) => {
      const query = typeof args.query === 'string' ? args.query.trim().slice(0, 100) : ''
      if (query.length < 2) throw new ToolError('Type at least two letters of the name.')
      const page = await browseGuides({ query })
      return {
        games: page.items.slice(0, 10).map((g) => ({
          id: g.id,
          name: g.name,
          platforms: g.platforms,
          guide: g.guide
            ? { difficulty: g.guide.difficulty ?? null, hours: g.guide.hours ?? null }
            : null,
        })),
      }
    },
  },
  {
    name: 'get_guide',
    description:
      "A game's platinum guide researched by PlatJourney: difficulty, hours, playthroughs, roadmap, missable trophies, online trophies, key trophies and known bugs.",
    inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
    run: async (_user, args) => {
      const game = await gameFrom(args)
      const guide = await getGuide<Record<string, unknown>>(game.id)
      return { game: gameRow(game), guide: guide ?? null }
    },
  },
  {
    name: 'search_deep_guide',
    description:
      'Passages from the full guides PlatJourney indexed for a game, the ones that answer a question (where a collectible is, how a trophy unlocks). Each passage names its source page.',
    inputSchema: {
      type: 'object',
      properties: {
        game: gameArg,
        question: { type: 'string', description: 'The question, in any language.' },
      },
      required: ['game', 'question'],
    },
    run: async (user, args) => {
      if (isDemo(user)) throw new ToolError('The deep guide is not part of the demo.')
      const game = await gameFrom(args)
      const question = typeof args.question === 'string' ? args.question.trim().slice(0, 500) : ''
      if (!question) throw new ToolError('Ask a question.')
      const found = await tagged({ user: user.id, action: 'mcp_deep_guide' }, () =>
        ai<{ passages: { source: string; url: string; heading: string; content: string }[] }>(
          '/deep-guide/retrieve',
          { game, question, terms: [], limit: 6 },
        ),
      )
      return {
        game: gameRow(game),
        passages: found.passages.map((p) => ({
          source: p.source,
          url: p.url,
          heading: p.heading,
          content: p.content,
        })),
      }
    },
  },
  {
    name: 'get_interests',
    description:
      "The games the player saved to platinum this year, with progress on each, the year's goal and the platinums already earned this year.",
    inputSchema: { type: 'object', properties: {} },
    next: SAVE_PICK,
    run: async (user) => {
      const titles = await library(user.psn_account_id)
      const p = await yearProgress(user, titles, undefined, await playtimes(user))
      return {
        year: p.year,
        goal: p.target,
        platinumsThisYear: p.platinumed.map((x) => ({
          game: x.game.name,
          at: x.at,
          hours: x.hours,
        })),
        interests: p.interests.map((i) => ({
          id: i.id,
          game: { id: i.game.id, name: i.game.name },
          progress: i.progress,
          hours: i.hours,
          done: i.done,
          deal: i.deal ?? null,
        })),
      }
    },
  },
  {
    name: 'get_library',
    description:
      "The player's games from PSN, the most recently played first: progress, platinum earned and hours played.",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'in_progress', 'platinumed'],
          description: 'Which games (default all).',
        },
        limit: { type: 'number', description: 'How many, up to 200 (default 50).' },
      },
    },
    run: async (user, args) => {
      const titles = await library(user.psn_account_id)
      const status = args.status
      const shown = [...titles]
        .filter((t) =>
          status === 'platinumed'
            ? t.earnedByType.platinum > 0
            : status === 'in_progress'
              ? t.earnedByType.platinum === 0 && t.earned > 0
              : true,
        )
        .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
        .slice(0, limitOf(args, 50, 200))
      const [games, played] = await Promise.all([gamesForTitles(shown, false), playtimes(user)])
      return {
        total: titles.length,
        games: shown.map((t) => {
          const game = games.get(t.npCommunicationId)
          return {
            id: game?.id ?? null,
            name: game?.name ?? t.name,
            platform: t.platform,
            progress: t.progress,
            platinum: t.earnedByType.platinum > 0,
            hoursPlayed: game ? hoursOf(played.get(game.id)) : null,
            lastPlayed: t.lastUpdated,
          }
        }),
      }
    },
  },
  {
    name: 'get_next_platinums',
    description:
      "The player's own games closest to the platinum, ranked by PlatJourney by the effort left (base game only), with each guide's difficulty and hours.",
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many, up to 20 (default 10).' } },
    },
    next: SAVE_PICK,
    run: async (user, args) => {
      const ranked = await rankNextPlatinum(
        await library(user.psn_account_id),
        user,
        limitOf(args, 10, 20),
      )
      const facts = new Map(
        (await guideFacts(ranked.map((r) => r.game.id))).map((f) => [String(f.game), f]),
      )
      return {
        games: ranked.map((r) => {
          const f = facts.get(r.game.id)
          return {
            game: gameRow(r.game),
            platform: r.title.platform,
            baseProgress: r.baseProgress,
            trophiesLeft: r.remaining,
            guide: f
              ? {
                  difficulty: f.difficulty ?? null,
                  hours: f.hours ?? null,
                  hasMissables: f.hasMissables ?? null,
                  hasOnline: f.hasOnline ?? null,
                }
              : null,
          }
        }),
      }
    },
  },
  {
    name: 'get_recommendations',
    description:
      "Games PlatJourney recommends from the player's library (its graph of similar games, no model): like the ones they play, quick platinums, and the rest of series they own. Each says which of the player's games led to it.",
    inputSchema: { type: 'object', properties: {} },
    next: SAVE_PICK,
    run: async (user) => {
      const titles = await library(user.psn_account_id)
      const picks = await similarPicks(user, titles, await ownedGames(user.psn_account_id))
      const row = (p: (typeof picks.items)[number]) => ({
        game: gameRow(p.game),
        difficulty: p.difficulty,
        hours: p.hours,
        hasMissables: p.hasMissables,
        because: p.because,
      })
      return {
        likeYourGames: picks.items.slice(0, 15).map(row),
        quickPlatinums: picks.quick.slice(0, 10).map(row),
        inYourSeries: picks.series.slice(0, 10).map(row),
      }
    },
  },
  {
    name: 'get_similar_games',
    description:
      'Games like one game: its expansions, base game and series first, then similar games, each with its guide difficulty and hours.',
    inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
    next: SAVE_PICK,
    run: async (_user, args) => {
      const game = await gameFrom(args)
      return {
        game: gameRow(game),
        similar: (await similarToGame(game.id)).slice(0, 15).map((s) => ({
          game: gameRow(s.game),
          relation: s.relation,
          difficulty: s.difficulty,
          hours: s.hours,
        })),
      }
    },
  },
  {
    name: 'get_releases',
    description:
      'PS4 and PS5 games that just came out or are coming out in the next weeks, the most awaited first, with the guide difficulty and hours when there is one.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const day = 86_400_000
      const now = Date.now()
      const releases = await releasesBetween(
        new Date(now - RELEASES_BEFORE_DAYS * day),
        new Date(now + RELEASES_AFTER_DAYS * day),
      )
      return { releases }
    },
  },
  {
    name: 'get_platinums',
    description:
      "The player's platinums, the latest first, with the unlock date, rarity and hours, plus totals by year and platform.",
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'How many, up to 200 (default 30).' } },
    },
    run: async (user, args) => {
      const page = await profilePage(await library(user.psn_account_id), user)
      return {
        total: page.platinums.length + page.pendingPlatinums,
        byYear: page.byYear,
        byPlatform: page.byPlatform,
        platinums: page.platinums.slice(0, limitOf(args, 30, 200)).map((p) => ({
          game: gameRow(p.game),
          platform: p.platform,
          earnedAt: p.earnedAt,
          rarity: p.rarity,
          hours: p.hours,
        })),
      }
    },
  },
  {
    name: 'add_interest',
    description:
      "Saves a game to the player's interests (the games they want to platinum this year).",
    inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
    changes: true,
    run: async (user, args) => {
      const game = await gameFrom(args)
      await interestCommand(user, `add ${game.id}`)
      return { saved: gameRow(game) }
    },
  },
  {
    name: 'remove_interest',
    description: "Removes a game from the player's interests.",
    inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
    changes: true,
    destructive: true,
    run: async (user, args) => {
      const interest = await savedInterest(user, await gameFrom(args))
      await interestCommand(user, `remove ${interest.id}`)
      return { removed: interest.game.name }
    },
  },
  {
    name: 'mark_owned',
    description:
      'Marks a saved game as already owned (bought but never opened, so PSN does not show it): it leaves the deals.',
    inputSchema: { type: 'object', properties: { game: gameArg }, required: ['game'] },
    changes: true,
    run: async (user, args) => {
      const interest = await savedInterest(user, await gameFrom(args))
      await interestCommand(user, `owned ${interest.id}`)
      return { owned: interest.game.name }
    },
  },
  {
    name: 'set_yearly_goal',
    description: 'Sets how many platinums the player wants this year.',
    inputSchema: {
      type: 'object',
      properties: { target: { type: 'number', description: 'Platinums this year, 1 to 365.' } },
      required: ['target'],
    },
    changes: true,
    run: async (user, args) => {
      const target = Number(args.target)
      if (!Number.isInteger(target) || target < 1 || target > 365)
        throw new ToolError('The goal is a whole number of platinums, from 1 to 365.')
      await interestCommand(user, `set ${target}`)
      return { year: new Date().getFullYear(), goal: target }
    },
  },
  {
    name: 'dismiss_recommendation',
    description:
      'Tells PlatJourney not to recommend a game again, optionally why, so similar ones weigh less.',
    inputSchema: {
      type: 'object',
      properties: {
        game: gameArg,
        reason: {
          type: 'string',
          enum: ['too_long', 'too_hard', 'genre', 'online', 'played'],
          description: 'Why, when the player said.',
        },
      },
      required: ['game'],
    },
    changes: true,
    run: async (user, args) => {
      const game = await gameFrom(args)
      const reason = isDismissReason(args.reason) ? args.reason : undefined
      await dismissRecommendation(user, game.id, reason)
      return { dismissed: game.name, reason: reason ?? null }
    },
  },
  {
    name: 'save_suggestion',
    description:
      'Saves a game you recommended to the player, with why in one sentence, so it shows in their PlatJourney app under your name. Call it with your final pick when you recommend a game (up to 3 per conversation); the same game again updates the reason.',
    inputSchema: {
      type: 'object',
      properties: {
        game: gameArg,
        reason: {
          type: 'string',
          description: "Why this game, for this player, in one sentence in the player's language.",
        },
      },
      required: ['game', 'reason'],
    },
    changes: true,
    run: async (user, args, from) => {
      const game = await gameFrom(args)
      const reason = textArg(args, 'reason', 280)
      await saveAssistantPick(user.id, game.id, reason, assistantOf(from))
      return { saved: gameRow(game), reason }
    },
  },
  {
    name: 'save_session_plan',
    description:
      'Saves a plan for the play session you made for the game the player is playing now, so it shows in their PlatJourney app as a checklist that ticks each step off when PSN reports the trophy. Name each step by its trophy as get_current_game lists it. It replaces the session plan saved before.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'How long the session is, in minutes.' },
        summary: { type: 'string', description: 'The plan in one or two sentences.' },
        steps: {
          type: 'array',
          description: 'The trophies to go for, in order (up to 20).',
          items: {
            type: 'object',
            properties: {
              trophy: { type: 'string', description: 'The trophy name.' },
              minutes: { type: 'number', description: 'About how long it takes.' },
              how: { type: 'string', description: 'What to do, briefly.' },
              why: { type: 'string', description: 'Why now, briefly.' },
              trick: { type: 'string', description: 'A trick that saves time, if any.' },
              flexible: {
                type: 'boolean',
                description: 'True when it can be done at any point of the session.',
              },
            },
            required: ['trophy', 'how'],
          },
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Missables or other cautions.',
        },
        ifTimeLeft: { type: 'string', description: 'What to do if time is left.' },
      },
      required: ['minutes', 'summary', 'steps'],
    },
    changes: true,
    run: async (user, args, from) => {
      const ctx = getCurrent(user)
      if (!ctx)
        throw new ToolError('The player is not playing anything right now (see get_current_game).')
      const minutes = Math.round(Number(args.minutes))
      if (!Number.isFinite(minutes) || minutes < 10 || minutes > 720)
        throw new ToolError('"minutes" is the session length, from 10 to 720.')
      const { steps, unknown } = planSteps(args.steps, ctx.trophies)
      if (!steps.length)
        throw new ToolError(
          `No step names a trophy of ${ctx.game.name}. Use the trophy names from get_current_game.`,
        )
      const warnings = Array.isArray(args.warnings)
        ? args.warnings.filter((w): w is string => typeof w === 'string').slice(0, 5)
        : []
      const plan: SessionPlan = {
        game: ctx.game.id,
        gameName: ctx.game.name,
        minutes,
        createdAt: new Date().toISOString(),
        summary: textArg(args, 'summary', 400),
        steps,
        totalMinutes: steps.reduce((n, s) => n + s.minutes, 0),
        warnings,
        ifTimeLeft: optText(args.ifTimeLeft, 300, null),
        assistant: assistantOf(from),
      }
      await updateUser(user.id, { session_plan: plan })
      return { saved: { game: gameRow(ctx.game), steps: steps.length }, notTrophies: unknown }
    },
  },
  {
    name: 'save_tip',
    description:
      'Saves a tip you gave the player (how to get a trophy, a route, a warning) to their PlatJourney history under your name, to find it later while playing. Call it when the player asks to save it, or for a tip worth coming back to; keep it short.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: "The tip, in the player's language (Markdown)." },
        game: { ...gameArg, description: `${gameArg.description} The game the tip is about.` },
      },
      required: ['text'],
    },
    changes: true,
    run: async (user, args, from) => {
      const text = textArg(args, 'text', 2000)
      const game = args.game ? await gameFrom(args) : undefined
      await logAssistantTip(user.id, assistantOf(from), text, game?.id)
      return { saved: true, ...(game ? { game: gameRow(game) } : {}) }
    },
  },
]
