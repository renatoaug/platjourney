import { config } from './config.ts'
import { currentTag } from './costs.ts'
import { DemoReadOnly } from './demo.ts'

// The AI service writes the prompts and talks to the model; this server gathers
// the facts it needs and sends them. Who and what the work is for rides along,
// so the service records each call's cost against the right user and action.

export class AiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// Research calls search the web and can take minutes; the service gives the model 5 min and one
// retry, so wait for both.
const TIMEOUT_MS = 11 * 60_000

export async function ai<T>(path: string, body: unknown): Promise<T> {
  const tag = currentTag()
  // A last guard: nothing done for the demo player may spend on the model.
  if (tag.demo) throw new DemoReadOnly()
  const res = await fetch(`${config.ai.url}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': config.ai.token,
      ...(tag.user ? { 'x-cost-user': tag.user } : {}),
      ...(tag.action ? { 'x-cost-action': tag.action } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new AiError(res.status, `ai ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}
