/** The reads about the player: their PSN profile, the game they play, their trophies, library,
 * platinums and this year's interests. */
import { isDemo, storedSummary, trophiesFor } from '../demo.ts'
import { yearProgress } from '../interests.ts'
import { library } from '../library.ts'
import type { GameContext } from '../nexo.ts'
import { currentPlan } from '../planner.ts'
import { playtimes } from '../playtime.ts'
import { profilePage } from '../profile.ts'
import { catalogTrophies, profileSummary } from '../psn.ts'
import { gamesForTitles } from '../repository/game.ts'
import type { User } from '../repository/user.ts'
import { currentOrCheck } from '../watcher.ts'
import {
  baseProgress,
  gameArg,
  gameFrom,
  gameRow,
  hoursOf,
  limitOf,
  MAX_TROPHIES,
  ownCopy,
  SAVE_PICK,
  type Tool,
  trophyRow,
} from './shared.ts'

export const getProfile: Tool = {
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
}

// The latest trophies earned, with their dates: where the player is in the game now.
const RECENT = 6

/** The session plan on screen for this game, its trophies and whether each is done; null without one. */
async function planRow(user: User, ctx: GameContext) {
  const plan = await currentPlan(user, ctx)
  if (!plan || plan.status !== 'active') return null
  return {
    summary: plan.summary,
    minutes: plan.minutes,
    validUntil: plan.expiresAt,
    // false: the player has not played since it was made, and it waits for the sitting until validUntil.
    started: plan.started,
    steps: plan.steps.map((s) => ({ trophy: s.trophy, minutes: s.minutes, done: s.done })),
  }
}

export const getCurrentGame: Tool = {
  name: 'get_current_game',
  description:
    'The game the player is playing now (from PSN): progress toward the platinum, hours played, the base-game trophies still missing, the last ones earned with their dates (where the player is in the game) and the session plan they have now for it, if any.',
  inputSchema: { type: 'object', properties: {} },
  next: 'If you plan a session for this game, start from where recentlyEarned puts the player, pick other trophies than currentPlan when they ask for another route, and save the plan with save_session_plan.',
  run: async (user) => {
    const ctx = await currentOrCheck(user)
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
        recentlyEarned: ctx.trophies
          .filter((t) => t.earned && t.earnedAt)
          .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''))
          .slice(0, RECENT)
          .map(trophyRow),
        currentPlan: await planRow(user, ctx),
      },
    }
  },
}

export const getTrophies: Tool = {
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
}

export const getInterests: Tool = {
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
}

export const getLibrary: Tool = {
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
}

export const getPlatinums: Tool = {
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
}
