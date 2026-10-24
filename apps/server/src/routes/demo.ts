import type { IncomingMessage, ServerResponse } from 'node:http'
import { DemoReadOnly } from '../demo.ts'
import { json, readBody } from '../http.ts'
import { isLocale } from '../i18n.ts'
import type { User } from '../repository/user.ts'
import { accountUser } from './api.ts'

// The demo player is shared by everyone who opens it, so it only reads. Writes the page makes on its
// own get a harmless answer: marking notices read or the introduction seen does nothing, and a
// language picked on the page applies to that page without being saved. Anything else that writes,
// or that would call PSN or the model, is refused with demo_read_only. True when the request was
// answered here.
export async function demoAnswered(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  method: string,
  me: User,
): Promise<boolean> {
  const path = url.pathname
  const refresh = path === '/api/recommendations' && url.searchParams.get('refresh') === '1'
  if (method === 'GET' && !refresh) return false
  // Connecting an assistant to the demo is allowed: its tools only read.
  if (path === '/api/oauth/authorize' && method === 'POST') return false
  if (
    (path === '/api/notifications/read' || path === '/api/account/onboarded') &&
    method === 'POST'
  ) {
    json(res, 200, { ok: true })
    return true
  }
  if (path === '/api/account/preferences' && method === 'POST') {
    const { includeDlcProgress, locale } = await readBody(req)
    if (includeDlcProgress === undefined && isLocale(locale)) {
      json(res, 200, { user: await accountUser({ ...me, locale }) })
      return true
    }
  }
  throw new DemoReadOnly()
}
