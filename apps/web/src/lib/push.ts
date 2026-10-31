/** Notices as push notifications on this device (Web Push): what the device can do, and turning it
 * on and off. The service worker in public/sw.js shows each notice. */
import { installed, installPlatform } from '../components/install-guide'
import { api, del } from './api'
import { isNative } from './native'

/**
 * - `unsupported`: this browser has no push
 * - `install`: an iPhone browser tab; push needs PlatJourney on the home screen first
 * - `native`: the native app, which has no push yet
 * - `denied`: the player blocked notifications for the site in the browser
 * - `off` / `on`: whether this device receives the notices
 */
export type PushState = 'unsupported' | 'install' | 'native' | 'denied' | 'off' | 'on'

const WORKER = '/sw.js'

function support(): PushState | null {
  if (isNative()) return 'native'
  const capable =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!capable) return installPlatform() === 'ios' && !installed() ? 'install' : 'unsupported'
  return null
}

async function subscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(WORKER)
  return (await reg?.pushManager.getSubscription()) ?? null
}

// The server stores a device as its endpoint and keys, exactly what toJSON() gives.
const save = (sub: PushSubscription) => api('/api/push/subscription', sub.toJSON())

/** Where this device stands. A device already on is saved again, in case the server dropped it. */
export async function pushState(): Promise<PushState> {
  const limit = support()
  if (limit) return limit
  if (Notification.permission === 'denied') return 'denied'
  const sub = await subscription().catch(() => null)
  if (!sub || Notification.permission !== 'granted') return 'off'
  await save(sub).catch(() => {})
  return 'on'
}

// The VAPID key travels base64url; the browser wants its bytes.
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Asks the browser's permission, subscribes this device and tells the server. */
export async function enablePush(key: string): Promise<PushState> {
  const limit = support()
  if (limit) return limit
  if ((await Notification.requestPermission()) !== 'granted')
    return Notification.permission === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.register(WORKER)
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    }))
  await save(sub)
  return 'on'
}

/** Stops the notices on this device, here and on the server. */
export async function disablePush(): Promise<PushState> {
  const sub = await subscription()
  if (sub) {
    await del('/api/push/subscription', { endpoint: sub.endpoint })
    await sub.unsubscribe()
  }
  return 'off'
}

// Set once the browser was asked on this device, whatever the answer.
const ASKED = 'platjourney:push-asked'

/** The first time the player opens the notifications, the browser asks to send them to this
 * device: opening them is the tap the browser needs to ask, and the moment the question makes
 * sense. Asked once per device and only while undecided; refused, the player turns it on later in
 * Settings. Called straight from the tap, before anything else waits. */
export function askPushOnce(key: string | null | undefined): void {
  if (!key || support() || Notification.permission !== 'default') return
  try {
    if (localStorage.getItem(ASKED)) return
    localStorage.setItem(ASKED, '1')
  } catch {
    return
  }
  enablePush(key).catch(() => {})
}
