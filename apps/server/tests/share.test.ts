import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as demo from '../src/demo.ts'
import * as playtime from '../src/playtime.ts'
import * as platinumRepo from '../src/repository/platinum.ts'
import { SHARE_ROUTES } from '../src/routes/share.ts'
import { JOURNEY_POINTS, journeyOf, platinumCard, shareableImage } from '../src/share.ts'
import { makeGame, makeTitle, makeTrophy, makeUser } from './api-fixtures.ts'

afterEach(() => mock.restore())

const at = (day: number, hour = 15) => new Date(Date.UTC(2026, 9, day, hour)).toISOString()

test('the journey counts trophies by the end of each day, first day to the platinum', () => {
  expect(journeyOf([at(1), at(1, 20), at(3), at(4)], at(4, 22))).toEqual([2, 2, 3, 4])
  expect(journeyOf([], at(4))).toEqual([])
  // The platinum's day closes the line even when nothing else fell on it.
  expect(journeyOf([at(1)], at(3))).toEqual([1, 1, 1])
})

test('a long hunt is sampled down, still from the first trophy to the last', () => {
  const dates = Array.from({ length: 200 }, (_, i) =>
    new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
  )
  const line = journeyOf(dates, dates[199] as string)
  expect(line).toHaveLength(JOURNEY_POINTS)
  expect(line[0]).toBe(1)
  expect(line.at(-1)).toBe(200)
})

test("the card numbers the platinum among the player's, counts the base game and finds the first trophy", () => {
  const plague = makeGame({ id: 'game:2', name: 'A Plague Tale: Requiem', art_url: 'art.jpg' })
  const card = platinumCard({
    gameId: 'game:2',
    platinums: [
      { game: plague, earnedAt: at(20), rarity: 3.3, hours: 34.9 },
      { game: makeGame(), earnedAt: at(2), rarity: 4.2, hours: 75 },
    ],
    title: makeTitle({ platform: 'PS5' }),
    trophies: [
      makeTrophy({
        id: 0,
        type: 'platinum',
        name: 'Réquiem',
        detail: 'Todos',
        earned: true,
        earnedAt: at(20),
      }),
      makeTrophy({ id: 1, type: 'gold', earned: true, earnedAt: at(10) }),
      makeTrophy({ id: 2, type: 'silver', earned: true, earnedAt: at(12) }),
      makeTrophy({ id: 3, type: 'bronze', earned: false }),
      makeTrophy({ id: 4, type: 'gold', earned: true, earnedAt: at(5), groupId: '001' }),
    ],
    player: { onlineId: 'Kratos', avatarUrl: null },
  })
  expect(card).toMatchObject({
    game: { id: 'game:2', artUrl: 'art.jpg' },
    number: 2,
    platform: 'PS5',
    trophy: { name: 'Réquiem', detail: 'Todos' },
    firstAt: at(10),
    hours: 34.9,
    rarity: 3.3,
    trophies: { earned: 3, total: 4, gold: 1, silver: 1, bronze: 0 },
  })
  expect(card?.journey.at(-1)).toBe(3)
})

test('no card for a game that is not among the platinums', () => {
  expect(
    platinumCard({
      gameId: 'game:9',
      platinums: [],
      title: makeTitle(),
      trophies: [],
      player: { onlineId: 'Kratos', avatarUrl: null },
    }),
  ).toBeNull()
})

test('the image proxy takes only the art hosts, over https', () => {
  expect(shareableImage('https://images.igdb.com/a.jpg')?.hostname).toBe('images.igdb.com')
  expect(shareableImage('http://psnobj.prod.dl.playstation.net/a.png')?.protocol).toBe('https:')
  expect(shareableImage('https://evil.example/a.png')).toBeNull()
  expect(shareableImage('https://images.igdb.com.evil.example/a.png')).toBeNull()
  expect(shareableImage('file:///etc/passwd')).toBeNull()
  expect(shareableImage('not a url')).toBeNull()
  expect(shareableImage(null)).toBeNull()
})

class FakeResponse {
  status = 0
  body: unknown = ''
  headers: Record<string, string> = {}
  writeHead(status: number, headers: Record<string, string> = {}) {
    this.status = status
    this.headers = { ...this.headers, ...headers }
    return this
  }
  end(body: unknown = '') {
    this.body = body
    return this
  }
}

async function call(route: string, url: string) {
  const res = new FakeResponse()
  await SHARE_ROUTES[route]?.({
    req: {} as IncomingMessage,
    res: res as unknown as ServerResponse,
    url: new URL(url, 'http://localhost'),
    me: makeUser({ avatar_url: 'http://psn.playstation.net/a.png' }),
    locale: 'pt-BR',
    titles: async () => [makeTitle({ npCommunicationId: 'NPWR1' })],
  })
  return res
}

test("GET /api/share/platinum answers the card of one of the player's platinums", async () => {
  spyOn(platinumRepo, 'listPlatinums').mockResolvedValue([
    {
      id: 'platinum:1',
      game: makeGame(),
      np_communication_id: 'NPWR1',
      trophy_name: 'Platina',
      earned_at: at(9),
      rarity_rate: 4.2,
    },
  ] as never)
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map())
  spyOn(demo, 'trophiesFor').mockResolvedValue([
    makeTrophy({ type: 'platinum', earned: true, earnedAt: at(9) }),
  ])
  const ok = await call('GET /api/share/platinum', '/api/share/platinum?game=game:1')
  expect(ok.status).toBe(200)
  expect(JSON.parse(String(ok.body))).toMatchObject({
    number: 1,
    player: { onlineId: 'Kratos', avatarUrl: 'https://psn.playstation.net/a.png' },
  })
  expect((await call('GET /api/share/platinum', '/api/share/platinum?game=game:2')).status).toBe(
    404,
  )
  expect((await call('GET /api/share/platinum', '/api/share/platinum?game=x')).status).toBe(400)
})

test('GET /api/share/image relays an allowed image and refuses anything else', async () => {
  const fetched = spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
  )
  const ok = await call('GET /api/share/image', '/api/share/image?u=https://images.igdb.com/a.png')
  expect(ok.status).toBe(200)
  expect(ok.headers['content-type']).toBe('image/png')
  expect(
    (await call('GET /api/share/image', '/api/share/image?u=https://evil.example/a.png')).status,
  ).toBe(400)
  expect(fetched).toHaveBeenCalledTimes(1)
  fetched.mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }))
  expect(
    (await call('GET /api/share/image', '/api/share/image?u=https://images.igdb.com/b')).status,
  ).toBe(502)
})
