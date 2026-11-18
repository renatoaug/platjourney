import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as demo from '../src/demo.ts'
import * as playtime from '../src/playtime.ts'
import * as platinumRepo from '../src/repository/platinum.ts'
import { SHARE_ROUTES } from '../src/routes/share.ts'
import {
  collectionCard,
  JOURNEY_POINTS,
  journeyOf,
  platinumCard,
  shareableImage,
} from '../src/share.ts'
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
    base: 'https://app.example.com',
  })
  expect(card).toMatchObject({
    link: 'https://app.example.com/profiles/Kratos?ref=share',
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
      base: 'https://app.example.com',
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
    req: {
      headers: { host: 'play.example.com', 'x-forwarded-proto': 'https' },
    } as unknown as IncomingMessage,
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

test('the collection card takes the month, the year or every platinum, the latest first', () => {
  const p = (id: string, earnedAt: string, hours: number | null = 10) => ({
    game: makeGame({ id, name: id, cover_url: `${id}.jpg` }),
    platform: 'PS5',
    earnedAt,
    rarity: 5,
    hours,
  })
  const platinums = [
    p('game:a', '2026-11-02T10:00:00Z'),
    p('game:b', '2026-11-15T10:00:00Z', null),
    p('game:c', '2026-03-01T10:00:00Z'),
    p('game:d', '2025-12-31T10:00:00Z'),
  ]
  const player = { onlineId: 'Kratos', avatarUrl: null }
  const base = 'https://app.example.com'
  const now = new Date('2026-11-18T12:00:00Z')
  const month = collectionCard({ period: 'month', now, platinums, player, base })
  expect(month.platinums.map((x) => x.game.id)).toEqual(['game:b', 'game:a'])
  expect(month).toMatchObject({ month: 11, year: 2026, total: 2, overall: 4, hours: 10 })
  const year = collectionCard({ period: 'year', now, platinums, player, base })
  expect(year.platinums.map((x) => x.game.id)).toEqual(['game:b', 'game:a', 'game:c'])
  expect(year.month).toBeNull()
  const all = collectionCard({ period: 'all', now, platinums, player, base })
  expect(all).toMatchObject({ total: 4, year: null, month: null, hours: 30 })
  expect(all.platinums[0]?.game.coverUrl).toBe('game:b.jpg')
})

test('GET /api/share/platinums answers the chosen period and refuses another', async () => {
  spyOn(platinumRepo, 'listPlatinums').mockResolvedValue([
    {
      id: 'platinum:1',
      game: makeGame(),
      np_communication_id: 'NPWR1',
      trophy_name: 'Platina',
      earned_at: new Date().toISOString(),
      rarity_rate: 4.2,
    },
  ] as never)
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map())
  const ok = await call('GET /api/share/platinums', '/api/share/platinums?period=month')
  expect(ok.status).toBe(200)
  expect(JSON.parse(String(ok.body))).toMatchObject({
    total: 1,
    platinums: [{ platform: 'PS5' }],
    // Without APP_URL, the link opens on the address the request came in on.
    link: 'https://play.example.com/profiles/Kratos?ref=share',
  })
  expect((await call('GET /api/share/platinums', '/api/share/platinums?period=week')).status).toBe(
    400,
  )
})
