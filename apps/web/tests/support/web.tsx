// Shared pieces for the web tests: a fake /api behind fetch, and rendering inside the router and
// the app state, the way the shell wires a screen.
import { spyOn } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { MockAppState } from '../../src/app/app-state'
import { ToastHost } from '../../src/ui/toast'

interface Call {
  path: string
  method: string
  body: unknown
}

type Answer = ((call: Call) => unknown) | object

/** A reply with a status other than 200; `body` is what the server would send. */
export const reply = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A request that never answers. */
export const never = () => new Promise<never>(() => {})

/**
 * Waits until `find` comes back empty. Unlike `waitFor(() => expect(node).toBeNull())`, a node still
 * there is never printed: bun's expect formats the whole element on each failed try, which takes
 * seconds and gigabytes and makes the test time out.
 */
export function gone(find: () => Element | null): Promise<void> {
  return waitFor(() => {
    if (find()) throw new Error('still on the page')
  })
}

/**
 * Fakes fetch for the given routes. A key is `METHOD /path?query`, `METHOD /path`, `/path?query`
 * or `/path`, tried in that order. A value is the JSON body, a Response, or a function of the call
 * returning either (or a promise). Anything else answers 404.
 */
export function mockApi(routes: Record<string, Answer>) {
  const calls: Call[] = []
  spyOn(globalThis, 'fetch').mockImplementation((async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const call = { path, method, body }
    calls.push(call)
    const bare = path.split('?')[0]
    const key = [`${method} ${path}`, `${method} ${bare}`, path, bare].find((k) => k in routes)
    if (!key) return reply(404, { message: `no route for ${method} ${path}` })
    const value = routes[key]
    const out = await (typeof value === 'function' ? (value as (c: Call) => unknown)(call) : value)
    return out instanceof Response ? out : new Response(JSON.stringify(out))
  }) as typeof fetch)
  return calls
}

/** Where the router is now, for asserting navigation. */
function LocationProbe() {
  const { pathname, search } = useLocation()
  return <output data-testid="location">{pathname + search}</output>
}

/** A screen inside a memory router, the mock app state and the toast host. */
export function renderApp(
  ui: ReactNode,
  {
    path = '/',
    route,
    value,
  }: {
    path?: string
    /** A route pattern when the screen reads params, like `/title/*`. */
    route?: string
    value?: Parameters<typeof MockAppState>[0]['value']
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MockAppState value={value}>
        {route ? (
          <Routes>
            <Route path={route} element={ui} />
          </Routes>
        ) : (
          ui
        )}
        <LocationProbe />
      </MockAppState>
      <ToastHost />
    </MemoryRouter>,
  )
}
