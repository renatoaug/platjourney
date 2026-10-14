/** Plugins: optional modules an instance loads at start (`PLUGINS=./a.ts,./b.ts`). A plugin adds
 * routes under /api/ext/, steps in before any request the app answers (its own routes, sign-in,
 * pages), signs players in, runs around model work and listens to account events, through a small
 * versioned context; without plugins every hook is a no-op. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openSession, sessionCookie } from './auth.ts'
import { q } from './db.ts'
import { json, readBody } from './http.ts'
import type { User } from './repository/user.ts'

export const PLUGIN_API = 2

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
/** What a route answers to; anything else gets 405. Reads are GET, changes POST and up. */
export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
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
  /** Answers `/api/ext/<path>` for one method (GET unless `method` says otherwise); `public`
   * routes skip sign-in. A route that changes anything must not be GET: a link opens a GET. */
  route(path: string, handler: Handler, options?: { public?: boolean; method?: RouteMethod }): void
  /** Runs before the app answers any request to `path` (exact, or a prefix ending in `*`, e.g.
   * '/api/auth/*' or '/ads.txt'), with the player when signed in. A handler that answers ends the
   * request there (replacing the app's answer); one that does not lets it through. */
  intercept(path: string, handler: Handler, options?: { method?: RouteMethod }): void
  /** Signs `user` in on this response, as the app's own sign-in does: for another way of signing
   * in, such as single sign-on. */
  signIn(res: ServerResponse, user: User): Promise<void>
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

const routes = new Map<string, { handler: Handler; public: boolean; method: RouteMethod }>()
const intercepts: { path: string; method?: RouteMethod; handler: Handler }[] = []
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
    routes.set(key, {
      handler,
      public: options?.public ?? false,
      method: options?.method ?? 'GET',
    })
  },
  intercept(path, handler, options) {
    intercepts.push({ path, method: options?.method, handler })
  },
  async signIn(res, user) {
    const { token } = await openSession(user)
    res.setHeader('set-cookie', sessionCookie(token))
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

/** The plugins' handlers that step in before the app answers this request, in the order they came. */
export function interceptsFor(pathname: string, method: string): Handler[] {
  return intercepts
    .filter((i) => !i.method || i.method === method)
    .filter((i) =>
      i.path.endsWith('*') ? pathname.startsWith(i.path.slice(0, -1)) : pathname === i.path,
    )
    .map((i) => i.handler)
}

/** For tests: forgets every plugin. */
export function resetPlugins(): void {
  routes.clear()
  intercepts.length = 0
  before.length = 0
  failed.length = 0
  listeners.clear()
}
