/** Reading a JSON request body and answering JSON: shared by the app's routes and the plugins'. */
import type { IncomingMessage, ServerResponse } from 'node:http'

export function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

export function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res
    .writeHead(status, { 'content-type': 'application/json', ...headers })
    .end(JSON.stringify(body, (key, value) => (key === 'embedding' ? undefined : value)))
}
