/** The MCP server at /mcp: assistants the player connected (Claude, ChatGPT and others) read the
 * player's profile, trophies, current game, interests and the guides through these tools, with the
 * bearer token from OAuth (oauth.ts). The assistant writes the answer: a tool returns facts and
 * never calls the model, so a read costs the instance nothing. Streamable HTTP without sessions: each POST is
 * one JSON-RPC message answered in JSON. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ai } from './ai.ts'
import { browseGuides } from './browse.ts'
import { config, version } from './config.ts'
import { tagged } from './costs.ts'
import { isDemo, storedSummary, trophiesFor } from './demo.ts'
import { BadBody, json, readBody } from './http.ts'
import { yearProgress } from './interests.ts'
import { library } from './library.ts'
import { bearer, resourceMetadataUrl } from './oauth.ts'
import { playtimes } from './playtime.ts'
import { beforeTool, Refused } from './plugins.ts'
import { catalogTrophies, profileSummary, type TitleProgress, type TrophyStatus } from './psn.ts'
import { loadGroups } from './ranking.ts'
import { allow } from './rate-limit.ts'
import { type Game, gameByName, getGame } from './repository/game.ts'
import { getGuide } from './repository/guide.ts'
import type { User } from './repository/user.ts'
import { demoContext, getCurrent } from './watcher.ts'

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MAX_TROPHIES = 300

/** A tool's failure the assistant should read and pass on (a game it did not find, a limit). */
class ToolError extends Error {}

type Args = Record<string, unknown>
interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  run: (user: User, args: Args) => Promise<unknown>
}

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

const TOOLS: Tool[] = [
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
          game: { id: i.game.id, name: i.game.name },
          progress: i.progress,
          hours: i.hours,
          done: i.done,
        })),
      }
    },
  },
]

const byName = new Map(TOOLS.map((t) => [t.name, t]))
const listed = TOOLS.map(({ name, description, inputSchema }) => ({
  name,
  description,
  inputSchema,
  annotations: { readOnlyHint: true, openWorldHint: false },
}))

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
})

async function callTool(user: User, connection: string, params: Args) {
  const tool = typeof params.name === 'string' ? byName.get(params.name) : undefined
  if (!tool) return text(`Unknown tool ${String(params.name)}.`, true)
  const limit = config.mcp.perMinute
  if (limit && !allow(`mcp|${connection}`, limit, 60_000))
    return text('Too many calls in a row. Wait a minute and try again.', true)
  try {
    await beforeTool({ user, tool: tool.name })
    const args = (params.arguments ?? {}) as Args
    const value = await tagged({ user: user.id }, () => tool.run(user, args))
    return { ...text(value), structuredContent: value }
  } catch (e) {
    if (e instanceof ToolError || e instanceof Refused) return text(e.message, true)
    console.error(`mcp ${tool.name} failed:`, (e as Error).message)
    return text('This could not be read right now. Try again in a moment.', true)
  }
}

const INSTRUCTIONS =
  "PlatJourney knows this player's PlayStation trophies and has a researched platinum guide for many games. Ground answers about trophies, missables and what to platinum in these tools instead of memory, and say which guide page a passage came from."

async function answer(user: User, connection: string, msg: Args) {
  const params = (msg.params ?? {}) as Args
  switch (msg.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'platjourney', title: 'PlatJourney', version },
        instructions: INSTRUCTIONS,
      }
    }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: listed }
    case 'tools/call':
      return callTool(user, connection, params)
    default:
      return undefined
  }
}

const OPEN = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
  'access-control-expose-headers': 'www-authenticate',
}

/** Answers /mcp; false for any other path. */
export async function mcpRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
): Promise<boolean> {
  if (url.pathname !== '/mcp') return false
  if (method === 'OPTIONS') {
    res.writeHead(204, { ...OPEN, 'access-control-allow-methods': 'POST' }).end()
    return true
  }
  const who = await bearer(req)
  if (!who) {
    json(
      res,
      401,
      { error: 'unauthorized' },
      {
        ...OPEN,
        'www-authenticate': `Bearer resource_metadata="${resourceMetadataUrl(req)}"`,
      },
    )
    return true
  }
  // No server-sent stream and no sessions: only POST.
  if (method !== 'POST') {
    res.writeHead(405, { ...OPEN, allow: 'POST' }).end()
    return true
  }
  let msg: Args
  try {
    msg = await readBody(req)
  } catch (e) {
    if (!(e instanceof BadBody)) throw e
    json(
      res,
      400,
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      OPEN,
    )
    return true
  }
  if (Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    json(
      res,
      400,
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } },
      OPEN,
    )
    return true
  }
  // A notification (no id) is only acknowledged.
  if (msg.id === undefined) {
    res.writeHead(202, OPEN).end()
    return true
  }
  const result = await answer(who.user, who.connection, msg)
  json(
    res,
    200,
    result === undefined
      ? { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } }
      : { jsonrpc: '2.0', id: msg.id, result },
    OPEN,
  )
  return true
}
