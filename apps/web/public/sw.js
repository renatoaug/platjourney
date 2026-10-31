// PlatJourney's service worker: shows Nexo's notices as push notifications and opens the app on a
// tap. It caches nothing; the app always loads from the network.

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'PlatJourney', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: { url: data.url || '/' },
    }),
  )
})

// A tap brings an open PlatJourney tab to the front on the notice's screen, or opens one. The page
// opens with ?from=push, so the app (or a plugin) can tell it came from a notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  target.searchParams.set('from', 'push')
  const url = target.href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((c) => new URL(c.url).origin === self.location.origin)
      if (tab) return tab.navigate(url).then((c) => (c ?? tab).focus())
      return self.clients.openWindow(url)
    }),
  )
})
