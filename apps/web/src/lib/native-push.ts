/** APNs lifecycle for the iOS Capacitor shell. A browser never calls a native plugin. */
import { api, del } from './api'
import { isNative } from './native'

interface PushPlugin {
  checkPermissions(): Promise<{ receive: string }>
  requestPermissions(): Promise<{ receive: string }>
  register(): Promise<void>
  unregister(): Promise<void>
  removeAllDeliveredNotifications(): Promise<void>
  addListener(
    event: string,
    listener: (event: { value?: string; notification?: { data?: { url?: unknown } } }) => void,
  ): Promise<{ remove(): Promise<void> }>
}
interface CapacitorBridge {
  getPlatform?: () => string
  Plugins?: { PushNotifications?: PushPlugin }
}
const bridge = () => (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
const plugin = () => bridge()?.Plugins?.PushNotifications
export const isIosPush = (): boolean =>
  isNative() && bridge()?.getPlatform?.() === 'ios' && !!plugin()

let owner: string | null = null
let available = false
let generation = 0
let listening: Promise<void> | undefined
let registering: Promise<void> | undefined
let saving: Promise<unknown> = Promise.resolve()
let registration:
  | { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  | undefined
const preference = (user = owner) => `platjourney:apns:${user}`
const enabled = () => !!owner && localStorage.getItem(preference()) === 'on'
function installation(): string {
  const key = 'platjourney:apns-installation'
  let id = localStorage.getItem(key)
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join('')
    localStorage.setItem(key, id)
  }
  return id
}

/** Only the notice route is accepted: APNs payloads cannot navigate to an external site. */
export function notificationPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/history') || value.includes('\\'))
    return null
  const url = new URL(value, window.location.origin)
  if (url.origin !== window.location.origin || url.pathname !== '/history') return null
  const tip = url.searchParams.get('tip')
  if (tip && !/^tip:[a-zA-Z0-9_-]+$/.test(tip)) return null
  return `/history?${tip ? `tip=${encodeURIComponent(tip)}&` : ''}from=push`
}

function settle(error?: Error) {
  if (!registration) return
  clearTimeout(registration.timer)
  const pending = registration
  registration = undefined
  if (error) pending.reject(error)
  else pending.resolve()
}

// Installed before authentication loads so a cold-start tap waits at the requested URL through login.
export function listenNativePush(): Promise<void> {
  if (!isIosPush()) return Promise.resolve()
  if (listening) return listening
  const push = plugin() as PushPlugin
  listening = (async () => {
    await push.addListener('pushNotificationActionPerformed', (event) => {
      const path = notificationPath(event.notification?.data?.url)
      if (!path) return
      history.pushState(null, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await push.addListener('registrationError', () => settle(new Error('APNs registration failed')))
    await push.addListener('registration', (event) => {
      const epoch = generation
      const current = owner
      if (!current || !enabled() || !event.value) return
      saving = saving
        .then(async () => {
          if (epoch !== generation || !enabled()) return
          await api('/api/push/native', {
            installation: installation(),
            token: event.value,
            owner: current,
          })
        })
        .then(() => {
          if (epoch === generation) settle()
        })
        .catch(() => {
          if (epoch === generation) settle(new Error('APNs registration could not be saved'))
        })
    })
  })()
  return listening
}

function register(): Promise<void> {
  if (!registering)
    registering = registerDevice().finally(() => {
      registering = undefined
    })
  return registering
}

async function registerDevice(): Promise<void> {
  await listenNativePush()
  if (registration) throw new Error('APNs registration in progress')
  const push = plugin() as PushPlugin
  await new Promise<void>((resolve, reject) => {
    registration = {
      resolve,
      reject,
      timer: setTimeout(() => settle(new Error('APNs registration timed out')), 15_000),
    }
    push.register().catch(() => settle(new Error('APNs registration failed')))
  })
}

export async function nativePushState(): Promise<'off' | 'on' | 'denied'> {
  if (!owner || !available) return 'off'
  const epoch = generation
  const permission = await plugin()?.checkPermissions()
  if (epoch !== generation) return 'off'
  if (permission?.receive !== 'granted') {
    await revokeDevice()
    return permission?.receive === 'denied' ? 'denied' : 'off'
  }
  if (!enabled()) {
    await revokeDevice()
    return 'off'
  }
  await register()
  return 'on'
}

export async function enableNativePush(): Promise<'off' | 'on' | 'denied'> {
  if (!owner || !available) return 'off'
  const current = owner
  const epoch = ++generation
  const key = preference()
  // Finish any queued revocation before a new opt-in can register this installation.
  await saving
  if (current !== owner || epoch !== generation) throw new Error('APNs session changed')
  const permission = await plugin()?.requestPermissions()
  if (current !== owner || epoch !== generation) return 'off'
  if (permission?.receive !== 'granted') return permission?.receive === 'denied' ? 'denied' : 'off'
  localStorage.setItem(preference(), 'on')
  try {
    await register()
  } catch (error) {
    if (epoch === generation) localStorage.removeItem(key)
    throw error
  }
  return 'on'
}

/** Keep the intent until BOTH native cleanup and server revocation succeed. A failed DELETE
 * must never restore registration on launch/resume or make the UI confirm that push is off. */
function revokeDevice(): Promise<void> {
  const current = owner
  const epoch = generation
  const key = preference(current)
  localStorage.setItem(key, 'revoking')
  const previous = saving
  const work = (async () => {
    // Attempt both native operations even if either one or the network fails.
    const cleanup = Promise.allSettled([
      plugin()?.unregister(),
      plugin()?.removeAllDeliveredNotifications(),
    ])
    const remote = (async () => {
      await previous
      if (current !== owner || epoch !== generation) throw new Error('APNs session changed')
      await del('/api/push/native', { installation: installation(), owner: current })
    })()
    const results = await Promise.allSettled([cleanup, remote])
    const local = results[0]
    if (
      results[1].status === 'rejected' ||
      local.status === 'rejected' ||
      local.value.some((result) => result.status === 'rejected')
    )
      throw new Error('APNs revocation pending')
    if (current !== owner || epoch !== generation) throw new Error('APNs session changed')
    if (localStorage.getItem(key) === 'revoking') localStorage.removeItem(key)
  })()
  // Registration and revocation share a queue; an error must not poison future retries.
  saving = work.catch(() => {})
  return work
}

export async function disableNativePush(): Promise<'off'> {
  if (!owner) throw new Error('APNs session ended')
  generation++
  settle(new Error('APNs disabled'))
  await revokeDevice()
  return 'off'
}

/** Re-register on launch/resume; a changed token replaces this installation's previous token. */
export function startNativePush(user: string | null, ready = false): () => void {
  if (!isIosPush()) return () => {}
  generation++
  settle(new Error('APNs session changed'))
  owner = user
  available = ready
  const refresh = () => {
    if (document.visibilityState !== 'hidden' && owner && available)
      nativePushState().catch(() => {})
  }
  const signOut = () => {
    generation++
    settle(new Error('APNs session ended'))
    owner = null
    plugin()
      ?.unregister()
      .catch(() => {})
    plugin()
      ?.removeAllDeliveredNotifications()
      .catch(() => {})
  }
  listenNativePush()
    .then(refresh)
    .catch(() => {})
  if (!user) signOut()
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', refresh)
  document.addEventListener('api:signout', signOut)
  return () => {
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', refresh)
    document.removeEventListener('api:signout', signOut)
    generation++
    owner = null
    settle(new Error('APNs session changed'))
  }
}
