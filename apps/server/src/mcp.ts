/** The MCP server at /mcp: assistants the player connected (Claude, ChatGPT and others) use the
 * player's PlatJourney through the tools in mcp-tools.ts, with the bearer token from OAuth
 * (oauth.ts), and offer three shortcuts that carry how Nexo thinks (what to play, a session plan, a
 * trophy tip). The assistant writes the answer: no tool calls the model, so using it costs the
 * instance nothing. Streamable HTTP without sessions: each POST is one JSON-RPC message answered in
 * JSON. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ai } from './ai.ts'
import { config, version } from './config.ts'
import { tagged } from './costs.ts'
import { isDemo } from './demo.ts'
import { BadBody, json, readBody } from './http.ts'
import { type Args, TOOLS, ToolError } from './mcp-tools.ts'
import { bearer, origin, resourceMetadataUrl } from './oauth.ts'
import { beforeTool, Refused } from './plugins.ts'
import { allow } from './rate-limit.ts'
import type { AssistantKey } from './repository/activity.ts'
import type { User } from './repository/user.ts'

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const byName = new Map(TOOLS.map((t) => [t.name, t]))
const listed = TOOLS.map(({ name, description, inputSchema, changes, destructive }) => ({
  name,
  description,
  inputSchema,
  annotations: {
    readOnlyHint: !changes,
    ...(changes ? { destructiveHint: destructive === true } : {}),
    openWorldHint: false,
  },
}))

const text = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
})

/** Who is calling: the player, their connection (the rate limit's key) and the assistant's name. */
interface Caller {
  user: User
  connection: string
  assistant: AssistantKey
}

async function callTool({ user, connection, assistant }: Caller, params: Args) {
  const tool = typeof params.name === 'string' ? byName.get(params.name) : undefined
  if (!tool) return text(`Unknown tool ${String(params.name)}.`, true)
  const limit = config.mcp.perMinute
  if (limit && !allow(`mcp|${connection}`, limit, 60_000))
    return text('Too many calls in a row. Wait a minute and try again.', true)
  if (tool.changes && isDemo(user))
    return text('This is the demo: it can be read, but nothing is saved.', true)
  try {
    await beforeTool({ user, tool: tool.name })
    const args = (params.arguments ?? {}) as Args
    const value = await tagged({ user: user.id }, () => tool.run(user, args, { assistant }))
    return { ...text(value), structuredContent: value }
  } catch (e) {
    if (e instanceof ToolError || e instanceof Refused) return text(e.message, true)
    console.error(`mcp ${tool.name} failed:`, (e as Error).message)
    return text('This could not be done right now. Try again in a moment.', true)
  }
}

const INSTRUCTIONS =
  "PlatJourney knows this player's PlayStation trophies and has a researched platinum guide for many games. Ground answers about trophies, missables, collectibles and what to platinum in these tools instead of memory, and say which guide page a passage came from. Change the player's interests or goal only when they ask. What you settle with the player can live in their PlatJourney app too: when you recommend a game, save your final pick with save_suggestion (up to 3 per conversation); when you plan a session, save it with save_session_plan; save a tip with save_tip when the player asks or it is worth coming back to."

// How Nexo thinks (services/ai method.py), asked once and kept: it changes only with a new version.
let method: Promise<{ pick: string; plan: string; tip: string }> | null = null
const nexoMethod = () => {
  method ??= ai<{ pick: string; plan: string; tip: string }>('/method', {}).catch((e) => {
    method = null
    throw e
  })
  return method
}

/** For tests: forgets the method asked from the AI service. */
export const forgetMethod = () => {
  method = null
}

interface Prompt {
  name: string
  title: string
  description: string
  arguments: { name: string; description: string; required: boolean }[]
  text: (m: Awaited<ReturnType<typeof nexoMethod>>, args: Record<string, string>) => string
}

// The shortcuts an assistant offers (a slash command, a menu): what to ask the tools for, and how
// Nexo weighs the answer. The assistant's own model does the thinking.
const PROMPTS: Prompt[] = [
  {
    name: 'what_to_play',
    title: 'What to platinum next',
    description: 'Nexo picks one game to platinum now, from your games, interests and pace.',
    arguments: [
      {
        name: 'mood',
        description: 'What you feel like right now (short, easy, a challenge…)',
        required: false,
      },
    ],
    text: (m, a) =>
      `Pick exactly one game for me to platinum next. Read get_current_game, get_next_platinums, get_interests and get_platinums (my last ones, for my pace); for games I do not have, get_recommendations. Look up get_guide for the finalists. ${a.mood ? `Right now I feel like: ${a.mood}. ` : ''}${m.pick} Answer with the game, why it fits now in two short sentences, and the first thing to do in it. Talk to me in my language.`,
  },
  {
    name: 'plan_session',
    title: 'Plan my session',
    description: 'A route for today: which trophies of the game you are playing fit in your time.',
    arguments: [{ name: 'minutes', description: 'How long you can play now', required: true }],
    text: (m, a) =>
      `Plan my play session of ${a.minutes || 60} minutes in the game I am playing. Read get_current_game for what is missing, get_guide for the roadmap and search_deep_guide for the steps. ${m.plan} Give the steps in order, each with the trophy and about how many minutes, and warn me of anything missable. Talk to me in my language.`,
  },
  {
    name: 'trophy_tip',
    title: 'Tip for a trophy',
    description: 'How to get a trophy, or what to do next in the game you are playing.',
    arguments: [
      { name: 'trophy', description: 'The trophy, if you have one in mind', required: false },
    ],
    text: (m, a) =>
      `${a.trophy ? `How do I get the trophy "${a.trophy}"?` : 'What should I do next for the platinum in the game I am playing?'} Read get_current_game and get_trophies, then get_guide and search_deep_guide for the exact steps, and say which page they came from. ${m.tip} Talk to me in my language.`,
  },
]

const promptList = PROMPTS.map(({ name, title, description, arguments: args }) => ({
  name,
  title,
  description,
  arguments: args,
}))

async function getPrompt(params: Args) {
  const prompt = PROMPTS.find((p) => p.name === params.name)
  if (!prompt) return undefined
  const given = (params.arguments ?? {}) as Record<string, unknown>
  const args = Object.fromEntries(
    Object.entries(given)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .map(([k, v]) => [k, v.slice(0, 200)]),
  )
  return {
    description: prompt.description,
    messages: [
      { role: 'user', content: { type: 'text', text: prompt.text(await nexoMethod(), args) } },
    ],
  }
}

// The app's icon, on its dark background, for the assistant's list of connectors.
const icons = (base: string) => [
  { src: `${base}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] },
  { src: `${base}/icon-512.png`, mimeType: 'image/png', sizes: ['512x512'] },
]

async function answer(caller: Caller, msg: Args, base: string) {
  const params = (msg.params ?? {}) as Args
  switch (msg.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: {
          name: 'platjourney',
          title: 'PlatJourney',
          version,
          websiteUrl: base,
          icons: icons(base),
        },
        instructions: INSTRUCTIONS,
      }
    }
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: listed }
    case 'tools/call':
      return callTool(caller, params)
    case 'prompts/list':
      return { prompts: promptList }
    case 'prompts/get':
      return getPrompt(params)
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
  let reply: Args
  try {
    const result = await answer(who, msg, origin(req))
    reply =
      result === undefined
        ? { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } }
        : { jsonrpc: '2.0', id: msg.id, result }
  } catch (e) {
    // A shortcut whose method could not be read: the assistant is told, in the protocol's terms.
    console.error(`mcp ${String(msg.method)} failed:`, (e as Error).message)
    reply = { jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'Internal error' } }
  }
  json(res, 200, reply, OPEN)
  return true
}
