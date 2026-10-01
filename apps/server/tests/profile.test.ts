import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as playtime from '../src/playtime.ts'
import { profilePage } from '../src/profile.ts'
import * as psn from '../src/psn.ts'
import * as games from '../src/repository/game.ts'
import * as platinums from '../src/repository/platinum.ts'
import type { Playtime } from '../src/repository/playtime.ts'
import { makeGame, makeTitle, makeTrophy, makeUser } from './api-fixtures.ts'

const summary = { onlineId: 'Kratos', level: 300, levelProgress: 10, earned: {} as never }
const settle = () => new Promise((r) => setTimeout(r, 0))
const plat = (id: string, earnedAt: string, rarity: number, game = makeGame({ id })) => ({
  id: `platinum:${id}`,
  game,
  np_communication_id: id,
  trophy_name: 'Platina',
  earned_at: earnedAt,
  rarity_rate: rarity,
})
const played = (game: string, seconds: number): Playtime => ({
  game,
  seconds,
  play_count: 1,
  first_played_at: null,
  last_played_at: null,
})
const platinumed = (np: string, lastUpdated = '2026-01-01') =>
  makeTitle({
    npCommunicationId: np,
    name: np,
    earnedByType: { bronze: 10, silver: 0, gold: 0, platinum: 1 },
    lastUpdated,
  })

let list: ReturnType<typeof spyOn>
let save: ReturnType<typeof spyOn>

beforeEach(() => {
  spyOn(psn, 'profileSummary').mockResolvedValue(summary)
  spyOn(playtime, 'playtimes').mockResolvedValue(new Map())
  spyOn(games, 'getGame').mockImplementation(async (id) => makeGame({ id, name: id }))
  spyOn(games, 'gamesForTitles').mockImplementation(
    async (titles) =>
      new Map(
        titles.map((t) => [t.npCommunicationId, makeGame({ id: `game:${t.npCommunicationId}` })]),
      ),
  )
  list = spyOn(platinums, 'listPlatinums').mockResolvedValue([])
  save = spyOn(platinums, 'savePlatinum').mockResolvedValue()
})

afterEach(() => mock.restore())

test('an empty profile has nothing to show', async () => {
  const page = await profilePage([], makeUser())
  expect(page).toEqual({
    summary,
    platinums: [],
    pendingPlatinums: 0,
    byYear: [],
    byPlatform: [],
    rarest: null,
    fastestStreak: null,
    totalHours: 0,
    mostPlayed: [],
  })
})

test('platinums are grouped by year and platform with the rarest and the best month', async () => {
  const library = [
    platinumed('A'),
    makeTitle({ npCommunicationId: 'B', platform: 'PS4' }),
    platinumed('C'),
  ].map((t) => ({ ...t, earnedByType: { ...t.earnedByType, platinum: 0 as const } }))
  list.mockResolvedValue([
    plat('A', '2024-03-01T00:00:00Z', 10),
    plat('B', '2025-05-01T00:00:00Z', 2),
    plat('C', '2025-05-20T00:00:00Z', 30),
    plat('D', '2025-06-10T00:00:00Z', 40),
  ])
  spyOn(playtime, 'playtimes').mockResolvedValue(
    new Map([
      ['A', played('A', 36_000)],
      ['B', played('B', 7_200)],
      ['gone', played('gone', 3_600)],
    ]),
  )
  spyOn(games, 'getGame').mockImplementation(async (id) =>
    id === 'gone' ? undefined : makeGame({ id }),
  )
  const page = await profilePage(library, makeUser())
  expect(page.platinums.map((p) => [p.platform, p.hours])).toEqual([
    ['PS5', 10],
    ['PS4', 2],
    ['PS5', null],
    ['', null],
  ])
  expect(page.byYear).toEqual([
    { year: 2024, count: 1 },
    { year: 2025, count: 3 },
  ])
  expect(page.byPlatform[0]).toEqual({ platform: 'PS5', count: 2 })
  expect(page.rarest?.game.id).toBe('B')
  expect(page.fastestStreak).toEqual({
    from: '2025-05-01T00:00:00Z',
    to: '2025-05-20T00:00:00Z',
    count: 2,
  })
  expect(page.totalHours).toBe(13)
  expect(page.mostPlayed.map((m) => [m.game.id, m.hours])).toEqual([
    ['A', 10],
    ['B', 2],
  ])
  expect(page.pendingPlatinums).toBe(0)
})

test('platinums without a date are fetched in the background', async () => {
  spyOn(console, 'error').mockImplementation(() => {})
  const trophies = spyOn(psn, 'titleTrophies').mockImplementation(async (title) => {
    if (title.npCommunicationId === 'BROKEN') throw new Error('psn down')
    if (title.npCommunicationId === 'UNEARNED') return [makeTrophy({ type: 'platinum' })]
    return [
      makeTrophy({ type: 'bronze', earned: true }),
      makeTrophy({
        name: 'Platina',
        type: 'platinum',
        earned: true,
        earnedAt: '2026-02-01',
        earnedRate: 3,
      }),
    ]
  })
  list.mockResolvedValue([plat('CACHED', '2025-01-01', 5)])
  const library = [
    platinumed('CACHED'),
    platinumed('NEW', '2026-02-01'),
    platinumed('BROKEN'),
    platinumed('UNEARNED'),
    makeTitle({ npCommunicationId: 'NOPLAT' }),
  ]
  const user = makeUser({ id: 'user:backfill' })
  const [page] = await Promise.all([profilePage(library, user), profilePage(library, user)])
  expect(page.pendingPlatinums).toBe(3)
  await settle()
  expect(trophies).toHaveBeenCalledTimes(3)
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledWith('user:backfill', {
    game: 'game:NEW',
    np_communication_id: 'NEW',
    trophy_name: 'Platina',
    earned_at: '2026-02-01',
    rarity_rate: 3,
  })
  expect(console.error).toHaveBeenCalledWith('platinum lookup failed for BROKEN:', 'psn down')
})

test('a failed backfill is logged and tried again on the next visit', async () => {
  spyOn(console, 'error').mockImplementation(() => {})
  const lookup = spyOn(games, 'gamesForTitles').mockRejectedValue(new Error('db down'))
  const user = makeUser({ id: 'user:retry' })
  await profilePage([platinumed('X')], user)
  await settle()
  expect(console.error).toHaveBeenCalledWith('platinum backfill failed:', 'db down')
  await profilePage([platinumed('X')], user)
  expect(lookup).toHaveBeenCalledTimes(2)
})

test('the demo profile comes from the stored library and platinums, without PSN', async () => {
  const titleTrophies = spyOn(psn, 'titleTrophies')
  const demo = makeUser({ demo: true, psn_online_id: 'PlatJourneyDemo' })
  const page = await profilePage([platinumed('NP1')], demo)
  await settle()
  expect(page.summary).toMatchObject({ onlineId: 'PlatJourneyDemo', earned: { platinum: 1 } })
  expect(page.pendingPlatinums).toBe(1)
  expect(psn.profileSummary).not.toHaveBeenCalled()
  expect(titleTrophies).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
