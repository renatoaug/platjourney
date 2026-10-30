/** What an assistant saves to the player's app under its own name: its pick, its list of
 * recommendations, a session plan and a tip. */
import { getCurrent } from '../game-context.ts'
import { ownedGames } from '../library.ts'
import { type PlanStep, type SessionPlan, startPlan } from '../planner.ts'
import type { TrophyStatus } from '../psn.ts'
import { saveAssistantRecommendations, type TasteProfile } from '../recommend.ts'
import { logAssistantTip } from '../repository/activity.ts'
import type { Game } from '../repository/game.ts'
import { saveAssistantPick } from '../repository/recommendation.ts'
import {
  type Args,
  assistantOf,
  gameArg,
  gameFrom,
  gameRow,
  optText,
  type Tool,
  ToolError,
  textArg,
  WHY,
} from './shared.ts'

const plainName = (s: string) => s.trim().toLowerCase()

// How many games a saved list holds: fewer is a pick (save_suggestion), more is not read.
const MIN_LIST = 3
const MAX_LIST = 10

// Up to `max` short texts from an array argument.
const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string' && !!x.trim())
        .map((x) => x.trim().slice(0, 60))
        .slice(0, max)
    : []

// The taste an assistant read, when it sent one with a summary and genres.
function profileArg(v: unknown): TasteProfile | undefined {
  if (!v || typeof v !== 'object') return undefined
  const p = v as Args
  const summary = optText(p.summary, 300, '')
  const genres = strings(p.genres, 8)
  if (!summary || !genres.length) return undefined
  return { summary, genres, traits: strings(p.traits, 8), avoid: strings(p.avoid, 8) }
}

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

export const saveSuggestion: Tool = {
  name: 'save_suggestion',
  description:
    'Saves the game you recommended to the player, with why and where to start, so it shows in their PlatJourney app as their latest pick, under your name. Call it with your main pick when you recommend what to play; the same game again updates it.',
  inputSchema: {
    type: 'object',
    properties: {
      game: gameArg,
      reason: {
        type: 'string',
        description: `Why this game, for this player, ${WHY}.`,
      },
      firstStep: {
        type: 'string',
        description:
          "Where to start: the first thing to do in the game for the platinum (a missable to watch, an order to follow), in one sentence in the player's language.",
      },
    },
    required: ['game', 'reason', 'firstStep'],
  },
  changes: true,
  run: async (user, args, from) => {
    const game = await gameFrom(args)
    const reason = textArg(args, 'reason', 600)
    const firstStep = optText(args.firstStep, 280, undefined)
    await saveAssistantPick(user.id, {
      game: game.id,
      why: reason,
      firstStep,
      assistant: assistantOf(from),
    })
    return { saved: gameRow(game), reason, firstStep: firstStep ?? null }
  },
}

export const saveRecommendations: Tool = {
  name: 'save_recommendations',
  description:
    "Saves the list of games you recommended from the player's taste, so their PlatJourney app shows it as your picks, under your name, in place of the last list. Only catalog games with a PlatJourney guide that the player does not own count; the others come back as skipped.",
  inputSchema: {
    type: 'object',
    properties: {
      games: {
        type: 'array',
        description: `The games, best first (${MIN_LIST} to ${MAX_LIST}).`,
        items: {
          type: 'object',
          properties: {
            game: gameArg,
            reason: { type: 'string', description: `Why this game, for this player, ${WHY}.` },
            similarTo: {
              type: 'array',
              items: { type: 'string' },
              description: "The player's games that led to it, by name.",
            },
          },
          required: ['game', 'reason'],
        },
      },
      profile: {
        type: 'object',
        description:
          "The player's taste you read from their games, kept only when PlatJourney has none yet (get_taste_profile returned null).",
        properties: {
          summary: { type: 'string', description: "One sentence in the player's language." },
          genres: { type: 'array', items: { type: 'string' } },
          traits: { type: 'array', items: { type: 'string' } },
          avoid: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary', 'genres'],
      },
    },
    required: ['games'],
  },
  changes: true,
  run: async (user, args, from) => {
    const list = Array.isArray(args.games) ? (args.games as Args[]) : []
    if (list.length < MIN_LIST)
      throw new ToolError(`Save at least ${MIN_LIST} games; for one game use save_suggestion.`)
    const items: { game: Game; why: string; similarTo: string[] }[] = []
    const missing: string[] = []
    for (const g of list.slice(0, MAX_LIST)) {
      const game = await gameFrom(g).catch(() => undefined)
      if (!game) {
        missing.push(String(g.game ?? ''))
        continue
      }
      if (items.some((i) => i.game.id === game.id)) continue
      items.push({
        game,
        why: textArg(g, 'reason', 600),
        similarTo: strings(g.similarTo, 5),
      })
    }
    const assistant = assistantOf(from)
    const { saved, skipped } = await saveAssistantRecommendations(
      user,
      items,
      await ownedGames(user.psn_account_id),
      assistant,
      profileArg(args.profile),
    )
    return {
      saved: saved.map(gameRow),
      skipped: [...missing.map((m) => ({ game: m, reason: 'not in the catalog' })), ...skipped],
    }
  },
}

export const saveSessionPlan: Tool = {
  name: 'save_session_plan',
  description:
    "Saves a plan for the play session you made for the game the player is playing now, so it shows in their PlatJourney app as a checklist that ticks each step off when PSN reports the trophy. Name each step by its trophy as get_current_game lists it, starting from where its recentlyEarned puts the player. It replaces the session plan on screen (get_current_game's currentPlan): when the player asked for another route, choose other trophies than that one.",
  inputSchema: {
    type: 'object',
    properties: {
      minutes: { type: 'number', description: 'How long the session is, in minutes.' },
      summary: { type: 'string', description: 'The plan in one or two sentences.' },
      steps: {
        type: 'array',
        description:
          'The trophies earned this session, in order (up to 20), each in one step only. Collectibles toward a trophy that will not finish this session are not steps: put them in the "how" of the step where they are.',
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
    await startPlan(user, plan, ctx)
    return { saved: { game: gameRow(ctx.game), steps: steps.length }, notTrophies: unknown }
  },
}

export const saveTip: Tool = {
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
}
