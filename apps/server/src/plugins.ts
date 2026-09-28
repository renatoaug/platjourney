/** Plugins: optional modules an instance loads at start (`PLUGINS=./a.ts,./b.ts`). A plugin adds
 * routes under /api/ext/, runs around model work and listens to account events, through a small
 * versioned context; without plugins every hook is a no-op. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { q } from './db.ts'
import { json, readBody } from './http.ts'
import type { User } from './repository/user.ts'

export const PLUGIN_API = 1

/** Model work about to run or that failed: the player and the action (chat, tip, plan…). */
export interface ModelWork {
  user: User
  action: string
}

/** Thrown by a beforeModel hook to stop the work; the player gets `message` with `status`. */
export class Refused extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 402,
  ) {
    super(message)
  }
}

export interface PluginRequest {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  method: string
  /** The signed-in player; absent on public routes (a payment provider's webhook). */
  me?: User
}

type Handler = (r: PluginRequest) => Promise<void>
type Hook = (work: ModelWork) => Promise<void>
// Account events: created after sign-up, deleted before the account and its data go.
type Events = { 'user:created': User; 'user:deleted': User }

export interface PluginContext {
  api: typeof PLUGIN_API
  /** The app's database: a plugin keeps its own tables there (snake_case, singular). */
  db: { q: typeof q }
  /** Throw from a beforeModel hook (or a route) to refuse with a status and a message. */
  Refused: typeof Refused
  /** Reads a request's JSON body. */
  readBody: typeof readBody
  /** Answers JSON. */
  json: typeof json
  /** Answers `/api/ext/<path>`; `public` routes skip sign-in. */
  route(path: string, handler: Handler, options?: { public?: boolean }): void
  /** Runs before model work; throw Refused to stop it. */
  beforeModel(hook: Hook): void
  /** Runs when model work failed after beforeModel let it through. */
  modelFailed(hook: Hook): void
  on<E extends keyof Events>(event: E, listener: (payload: Events[E]) => Promise<void>): void
}

export interface Plugin {
  name: string
  register(context: PluginContext): void | Promise<void>
}

const routes = new Map<string, { handler: Handler; public: boolean }>()
const before: Hook[] = []
const failed: Hook[] = []
type Listener = (payload: never) => Promise<void>
const listeners = new Map<keyof Events, Listener[]>()

// Everything a plugin uses comes through here, so it imports nothing from the app at runtime and
// can live in any folder.
const context = (name: string): PluginContext => ({
  api: PLUGIN_API,
  db: { q },
  Refused,
  readBody,
  json,
  route(path, handler, options) {
    const key = path.replace(/^\/+/, '')
    if (routes.has(key)) throw new Error(`plugin ${name}: route ${key} is taken`)
    routes.set(key, { handler, public: options?.public ?? false })
  },
  beforeModel: (hook) => before.push(hook),
  modelFailed: (hook) => failed.push(hook),
  on(event, listener) {
    listeners.set(event, [...(listeners.get(event) ?? []), listener as Listener])
  },
})

export async function registerPlugin(plugin: Plugin): Promise<void> {
  await plugin.register(context(plugin.name))
  console.log(`plugin: ${plugin.name}`)
}

// Relative paths in PLUGINS start at the repository's root, whatever folder the server runs in.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/** Loads the modules listed in PLUGINS, each exporting a Plugin as default. */
export async function loadPlugins(list = process.env.PLUGINS ?? ''): Promise<void> {
  for (const path of list
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const module = await import(resolve(ROOT, path))
    await registerPlugin(module.default as Plugin)
  }
}

/** Runs `work` between the plugins' beforeModel and, when it throws, modelFailed hooks. */
export async function aroundModel<T>(work: ModelWork, run: () => Promise<T>): Promise<T> {
  for (const hook of before) await hook(work)
  try {
    return await run()
  } catch (e) {
    for (const hook of failed)
      await hook(work).catch((err) => console.error('plugin hook failed:', err))
    throw e
  }
}

export async function emit<E extends keyof Events>(event: E, payload: Events[E]): Promise<void> {
  for (const listener of listeners.get(event) ?? [])
    await (listener as (p: Events[E]) => Promise<void>)(payload)
}

/** The plugin route for /api/ext/<path>, if any. */
export function pluginRoute(pathname: string) {
  return pathname.startsWith('/api/ext/')
    ? routes.get(pathname.slice('/api/ext/'.length))
    : undefined
}

/** For tests: forgets every plugin. */
export function resetPlugins(): void {
  routes.clear()
  before.length = 0
  failed.length = 0
  listeners.clear()
}
