/** Fetch wrapper for /api. Sends JSON, surfaces known failures as events and toasts. */
import { defineMessages, getLocale, Language, translator } from '../i18n/i18n'
import { refusalAction } from '../plugins'
import { toast } from '../ui/toast'

const messages = defineMessages({
  [Language.PtBR]: {
    refused: 'Isso não está disponível agora.',
    demoReadOnly: 'Isto é uma demonstração: nada é salvo.',
  },
  [Language.En]: {
    refused: 'This is not available right now.',
    demoReadOnly: 'This is a demo: nothing is saved.',
  },
})
const t = translator(messages)

export class ApiError extends Error {
  status: number
  code?: string
  friendly?: string
  /** Already handled for the user (a toast or a notice); callers should not show another error. */
  handled = false
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// The server answers notices and errors in the language the page is showing.
const send = (path: string, method: string, body: unknown) =>
  fetch(path, {
    method,
    headers: {
      'accept-language': getLocale(),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

export const api = <T = unknown>(path: string, body?: unknown): Promise<T> =>
  send(path, body === undefined ? 'GET' : 'POST', body).then((r) => answer<T>(r))

export const del = <T = unknown>(path: string, body?: unknown): Promise<T> =>
  send(path, 'DELETE', body).then((r) => answer<T>(r))

// Failures carry the HTTP status and the server's message (already in the active locale).
async function answer<T>(r: Response): Promise<T> {
  if (r.ok) return r.json() as Promise<T>
  const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string }
  const error = new ApiError(body.message ?? `HTTP ${r.status}`, r.status)
  error.code = body.error
  error.friendly = body.message
  // The app shell reacts to these (login screen, privacy notice); api stays free of React.
  if (r.status === 401) document.dispatchEvent(new Event('api:unauthorized'))
  if (r.status === 409 && body.error === 'trophies_private') {
    document.dispatchEvent(new Event('api:private-profile'))
    error.handled = true
  }
  // The demo only reads: the server's notice says so, once, instead of a failure.
  if (r.status === 403 && body.error === 'demo_read_only') {
    toast(body.message ?? t('demoReadOnly'), 'info')
    error.handled = true
  }
  // Model work refused by a plugin's rule: its message, and the action the plugin offers next to it.
  if (r.status === 402) {
    const refusal = { code: body.error ?? '', message: body.message ?? t('refused') }
    toast(refusal.message, 'error', refusalAction(refusal))
    error.handled = true
  }
  throw error
}
