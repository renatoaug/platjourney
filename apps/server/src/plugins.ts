/** Plugins: optional modules an instance loads at start (`PLUGINS=./a.ts,./b.ts`). A plugin adds
 * routes under /api/ext/, steps in before any request the app answers (its own routes, sign-in,
 * pages), signs players in, runs around model work and listens to account events, through a small
 * versioned context; without plugins every hook is a no-op. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openSession, sessionCookie } from './auth.ts'
import { q } from './db.ts'
import { json, type PageDirective, pagePolicy, pageSourceProblem, readBody } from './http.ts'
import { defineMessages, Language, translator } from './i18n.ts'
import type { User } from './repository/user.ts'

/** @public part of the plugin API */
export const PLUGIN_API = 3

/** How long a plugin's hook (beforeModel, an event listener, an interceptor) may take before the
 * app stops waiting for it: a hung plugin fails that one request instead of holding it forever. */
const HOOK_TIMEOUT_MS = 10_000
let hookTimeout = HOOK_TIMEOUT_MS

const messages = defineMessages({
  [Language.PtBR]: { busy: 'Não deu para começar agora. Tente de novo em instantes.' },
  [Language.En]: { busy: 'This could not start right now. Try again in a moment.' },
})

/** A plugin's hook that took longer than HOOK_TIMEOUT_MS. */
class PluginTimeout extends Error {
  constructor(label: string, ms: number) {
    super(`plugin ${label} took longer than ${ms} ms`)
  }
}

// `pending`, or PluginTimeout once the hook took too long. A hook cannot be cancelled: when one that
// timed out finishes after all, `late` runs (to give back what it took for a request already gone).
function withTimeout<T>(pending: Promise<T>, label: string, late?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      reject(new PluginTimeout(label, hookTimeout))
    }, hookTimeout)
  })
  const hook = Promise.resolve(pending)
  hook.then(
    () => timedOut && late?.(),
    () => {},
  )
  return Promise.race([hook, expired]).finally(() => clearTimeout(timer))
}

/** Model work about to run or that failed: the player and the action (chat, tip, plan…). */
/** @public part of the plugin API */
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

/** @public part of the plugin API */
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
/** @public part of the plugin API */
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
  /** Lets the app's page load from `sources` for one directive (`script-src`, `frame-src`,
   * `connect-src`, `img-src`, `style-src`, `font-src`), e.g. a provider's script and frames. */
  allowOnPage(directive: PageDirective, ...sources: string[]): void
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
const pageSources: Partial<Record<PageDirective, string[]>> = {}
// Model hooks keep the plugin they came from, so a refusal gives back only what the plugins that
// already ran took.
const before: { plugin: string; hook: Hook }[] = []
const failed: { plugin: string; hook: Hook }[] = []
type Listener = (payload: never) => Promise<void>
const listeners = new Map<keyof Events, { plugin: string; listener: Listener }[]>()

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
    const label = `${name}: intercept ${path}`
    intercepts.push({
      path,
      method: options?.method,
      handler: (r) => withTimeout(handler(r), label),
    })
  },
  async signIn(res, user) {
    const { token } = await openSession(user)
    res.setHeader('set-cookie', sessionCookie(token))
  },
  allowOnPage(directive, ...sources) {
    for (const source of sources) {
      const problem = pageSourceProblem(directive, source)
      if (problem) throw new Error(`plugin ${name}: allowOnPage: ${problem}`)
    }
    pageSources[directive] = [...(pageSources[directive] ?? []), ...sources]
  },
  beforeModel: (hook) => before.push({ plugin: name, hook }),
  modelFailed: (hook) => failed.push({ plugin: name, hook }),
  on(event, listener) {
    const list = listeners.get(event) ?? []
    listeners.set(event, [...list, { plugin: name, listener: listener as Listener }])
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

// The modelFailed hooks of `plugins` (all of them when absent), each one's failure only logged.
async function giveBack(work: ModelWork, plugins?: ReadonlySet<string>): Promise<void> {
  for (const { plugin, hook } of failed)
    if (!plugins || plugins.has(plugin))
      await hook(work).catch((err) => console.error('plugin hook failed:', err))
}

/** Runs `work` between the plugins' beforeModel and, when it throws, modelFailed hooks. A
 * beforeModel hook that refuses (or takes longer than HOOK_TIMEOUT_MS) stops the work, and the
 * plugins whose hooks already ran get modelFailed to give back what they took. */
export async function aroundModel<T>(work: ModelWork, run: () => Promise<T>): Promise<T> {
  const ran = new Set<string>()
  for (const { plugin, hook } of before) {
    try {
      await withTimeout(hook(work), `${plugin}: beforeModel`, () => {
        giveBack(work, new Set([plugin]))
      })
    } catch (e) {
      await giveBack(work, ran)
      if (!(e instanceof PluginTimeout)) throw e
      console.error(e.message)
      throw new Refused('plugin_timeout', translator(messages, work.user)('busy'), 503)
    }
    ran.add(plugin)
  }
  try {
    return await run()
  } catch (e) {
    await giveBack(work)
    throw e
  }
}

/** Tells the plugins' listeners about an account event, one after the other. A listener that throws
 * stops it (the caller decides); one that takes longer than HOOK_TIMEOUT_MS is logged and skipped. */
export async function emit<E extends keyof Events>(event: E, payload: Events[E]): Promise<void> {
  for (const { plugin, listener } of listeners.get(event) ?? []) {
    try {
      await withTimeout(
        (listener as (p: Events[E]) => Promise<void>)(payload),
        `${plugin}: ${event}`,
      )
    } catch (e) {
      if (!(e instanceof PluginTimeout)) throw e
      console.error(e.message)
    }
  }
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

/** The content security policy of the app's page, with what plugins allowed on it. */
export function pluginPagePolicy(): string {
  return pagePolicy(pageSources)
}

/** For tests: how long a hook may take; resetPlugins puts HOOK_TIMEOUT_MS back. */
export function setHookTimeout(ms: number): void {
  hookTimeout = ms
}

/** For tests: forgets every plugin. */
export function resetPlugins(): void {
  hookTimeout = HOOK_TIMEOUT_MS
  routes.clear()
  intercepts.length = 0
  for (const d of Object.keys(pageSources)) delete pageSources[d as PageDirective]
  before.length = 0
  failed.length = 0
  listeners.clear()
}
