/** Reading a JSON request body and answering JSON: shared by the app's routes and the plugins'. */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** A request body the server will not read: too big (413) or not JSON (400). */
export class BadBody extends Error {
  constructor(public readonly status: 400 | 413) {
    super(status === 413 ? 'body too large' : 'body is not JSON')
  }
}

const MAX_BODY = 100_000

export function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    let done = false
    req.on('data', (chunk) => {
      if (done) return
      raw += chunk
      if (raw.length > MAX_BODY) {
        done = true
        reject(new BadBody(413))
        req.resume()
      }
    })
    req.on('end', () => {
      if (done) return
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new BadBody(400))
      }
    })
    req.on('error', reject)
  })
}

/** On every answer: no content sniffing, no framing by other sites, no full URL to them. */
export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
}

/** On the app's page: where scripts, styles, fonts, images, requests and frames may come from.
 * Plugins can add sources to these (ctx.allowOnPage); the other directives stay as they are. */
const PAGE_SOURCES = {
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
  'img-src': ["'self'", 'https:', 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'frame-src': ["'self'"],
}
export type PageDirective = keyof typeof PAGE_SOURCES

/** The page's policy, with any sources plugins added to each directive. */
export function pagePolicy(added: Partial<Record<PageDirective, string[]>> = {}): string {
  return [
    "default-src 'self'",
    ...Object.entries(PAGE_SOURCES).map(([directive, sources]) =>
      [directive, ...new Set([...sources, ...(added[directive as PageDirective] ?? [])])].join(' '),
    ),
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ')
}

export function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string | string[]> = {},
): void {
  res
    .writeHead(status, { 'content-type': 'application/json', ...SECURITY_HEADERS, ...headers })
    .end(JSON.stringify(body, (key, value) => (key === 'embedding' ? undefined : value)))
}
