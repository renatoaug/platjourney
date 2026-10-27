import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { startTracking, track } from '../../src/lib/track'

afterEach(() => mock.restore())

const sent = (beacon: ReturnType<typeof mock>) =>
  Promise.all(
    beacon.mock.calls.map(async ([, blob]) => JSON.parse(await (blob as Blob).text()).events),
  )

test('nothing is queued until tracking starts, and leaving the page sends the batch', async () => {
  const beacon = mock((_url: string, _data?: BodyInit | null) => true)
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
  track('screen', '/guides')
  const stop = startTracking()
  track('screen', '/guides')
  track('search', '')
  const details = document.createElement('details')
  details.dataset.keyDetail = 'note-1'
  document.body.append(details)
  // Opening it fires the browser's own toggle event.
  details.open = true
  await new Promise((r) => setTimeout(r, 0))
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  const [batch] = await sent(beacon)
  expect(batch.map((e: { name: string; target: string }) => [e.name, e.target])).toEqual([
    ['screen', '/guides'],
    ['open', 'note-1'],
  ])
  expect(beacon.mock.calls[0][0]).toBe('/api/events')
  stop()
  details.remove()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

test('without a beacon the batch goes as a request that outlives the page', () => {
  Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
  const f = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
  const stop = startTracking()
  track('screen', '/goals')
  stop()
  expect(f.mock.calls[0][0]).toBe('/api/events')
  expect(f.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true })
  expect(JSON.parse(String(f.mock.calls[0][1]?.body)).events[0]).toMatchObject({
    name: 'screen',
    target: '/goals',
  })
})
