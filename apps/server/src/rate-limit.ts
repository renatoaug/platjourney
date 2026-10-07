/** Requests per key in a fixed window, in memory: enough to stop a loop from one address. */

const windows = new Map<string, { count: number; since: number }>()

/** True while `key` has made fewer than `limit` requests in the last `windowMs`; counts this one. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  // Old windows go once in a while, so the map stays the size of the recent traffic.
  if (windows.size > 10_000)
    for (const [k, w] of windows) if (now - w.since > windowMs) windows.delete(k)
  const w = windows.get(key)
  if (!w || now - w.since > windowMs) {
    windows.set(key, { count: 1, since: now })
    return true
  }
  w.count++
  return w.count <= limit
}

/** For tests: forgets every window. */
export const resetRateLimits = () => windows.clear()
