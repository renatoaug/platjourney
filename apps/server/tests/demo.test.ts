import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as ai from '../src/ai.ts'
import * as auth from '../src/auth.ts'
import { tagged } from '../src/costs.ts'
import * as db from '../src/db.ts'
import {
  DEMO_ACCOUNT_ID,
  DemoReadOnly,
  demoUser,
  isDemo,
  isDemoAccount,
  storedProgress,
  storedSummary,
  storedTitles,
  trophiesFor,
  trophyLevel,
} from '../src/demo.ts'
import * as lib from '../src/library.ts'
import { planSession } from '../src/planner.ts'
import * as playtime from '../src/playtime.ts'
import * as psn from '../src/psn.ts'
import { loadGroups } from '../src/ranking.ts'
import * as playtimes from '../src/repository/playtime.ts'
import type { TitleRow } from '../src/repository/title.ts'
import * as titles from '../src/repository/title.ts'
import { counts, makeContext, makeGroups, makeTitle, makeTrophy, makeUser } from './fixtures.ts'

afterEach(() => mock.restore())

const demo = makeUser({ id: 'user:demo', psn_account_id: DEMO_ACCOUNT_ID, demo: true })
const row = (over: Partial<TitleRow> = {}): TitleRow => ({
  id: 'title:t1',
  user: demo.id,
  game: 'game:1',
  np_communication_id: 'NPWR1_00',
  name: 'Days Gone',
  platform: 'PS4',
  icon_url: 'icon.png',
  progress: 50,
  earned: 10,
  total: 20,
  earned_ids: [],
  groups: null,
  last_updated_at: '2026-05-01T10:00:00.000Z',
  last_tip_at: null,
  ...over,
})

test('the demo is the flagged user and its sentinel account', async () => {
  expect(isDemo(demo)).toBe(true)
  expect(isDemo(makeUser())).toBe(false)
  expect(isDemo(null)).toBe(false)
  expect(isDemoAccount(DEMO_ACCOUNT_ID)).toBe(true)
  expect(isDemoAccount('123456')).toBe(false)
  const one = spyOn(db, 'one').mockResolvedValue({ id: new db.RecordId('user', 'demo') })
  expect(await demoUser()).toEqual({ id: 'user:demo' } as never)
  expect(one).toHaveBeenCalledWith('SELECT * FROM user WHERE demo = true LIMIT 1')
})

test('a stored title adds the base game and the DLC per trophy type', () => {
  const groups = makeGroups({
    base: { ...makeGroups().base, earnedByType: counts(5, 1, 0, 1), definedByType: counts(7, 2) },
    dlc: { ...makeGroups().base, earnedByType: counts(1), definedByType: counts(3, 1, 1) },
  })
  expect(storedProgress(row({ groups }))).toEqual({
    npCommunicationId: 'NPWR1_00',
    name: 'Days Gone',
    platform: 'PS4',
    iconUrl: 'icon.png',
    progress: 50,
    earned: 10,
    total: 20,
    earnedByType: counts(6, 1, 0, 1),
    definedByType: counts(10, 3, 1),
    lastUpdated: '2026-05-01T10:00:00.000Z',
  })
})

test('without a split, the counts come from the stored trophy list', () => {
  const trophies = [
    makeTrophy({ type: 'bronze', earned: true }),
    makeTrophy({ type: 'gold' }),
    makeTrophy({ type: 'platinum' }),
    makeTrophy({ type: 'other' }),
  ]
  const title = storedProgress(row({ trophies }))
  expect(title.earnedByType).toEqual(counts(1))
  expect(title.definedByType).toEqual(counts(1, 0, 1, 1))
  expect(storedProgress(row()).definedByType).toEqual(counts())
})

test('the demo library is read from the database', async () => {
  const list = spyOn(titles, 'titlesOfAccount').mockResolvedValue([row()])
  expect((await storedTitles(DEMO_ACCOUNT_ID))[0].name).toBe('Days Gone')
  expect(list).toHaveBeenCalledWith(DEMO_ACCOUNT_ID)
  const all = spyOn(psn, 'allTitles')
  expect(await lib.library(DEMO_ACCOUNT_ID)).toHaveLength(1)
  expect(all).not.toHaveBeenCalled()
})

test('trophies come from PSN for a player and from the stored list for the demo', async () => {
  const psnList = [makeTrophy({ id: 9 })]
  const fromPsn = spyOn(psn, 'titleTrophies').mockResolvedValue(psnList)
  const get = spyOn(titles, 'getTitle').mockResolvedValue(row({ trophies: [makeTrophy()] }))
  const title = makeTitle()
  expect(await trophiesFor(title, makeUser())).toBe(psnList)
  expect(fromPsn).toHaveBeenCalledWith(title, 'acc1')
  expect(await trophiesFor(title, demo)).toEqual([makeTrophy()])
  expect(get).toHaveBeenCalledWith(demo.id, 'NPWR1_00')
  get.mockResolvedValue(undefined)
  expect(await trophiesFor(title, demo)).toEqual([])
  expect(fromPsn).toHaveBeenCalledTimes(1)
})

// Library totals: the platinum count is any number here.
const total = (bronze = 0, silver = 0, gold = 0, platinum = 0) => ({
  bronze,
  silver,
  gold,
  platinum,
})

test('the trophy level follows PSN points and steps', () => {
  expect(trophyLevel(total())).toEqual({ level: 1, progress: 0 })
  expect(trophyLevel(total(2))).toEqual({ level: 1, progress: 50 })
  expect(trophyLevel(total(0, 0, 0, 20))).toEqual({ level: 100, progress: 66 })
  expect(trophyLevel(total(0, 0, 0, 100)).level).toBe(233)
  expect(trophyLevel(total(0, 0, 100_000))).toEqual({ level: 999, progress: 100 })
})

test('the demo profile header adds up the library', () => {
  const summary = storedSummary({ ...demo, avatar_url: '/logo.svg' }, [
    makeTitle({ earnedByType: counts(10, 2, 1, 1) }),
    makeTitle({ earnedByType: counts(5, 0, 0, 1) }),
  ])
  expect(summary).toMatchObject({
    onlineId: 'Player',
    avatarUrl: '/logo.svg',
    earned: total(15, 2, 1, 2),
  })
  expect(summary.level).toBeGreaterThan(1)
  expect(storedSummary(demo, []).avatarUrl).toBeUndefined()
})

test('the demo split and hours are the stored ones, without PSN', async () => {
  const groups = makeGroups()
  spyOn(titles, 'getTitle').mockResolvedValue(row({ groups }))
  const fromPsn = spyOn(psn, 'titleGroups')
  expect(await loadGroups(makeTitle(), demo)).toBe(groups)
  spyOn(titles, 'getTitle').mockResolvedValue(undefined)
  expect(await loadGroups(makeTitle(), demo)).toBeNull()
  expect(fromPsn).not.toHaveBeenCalled()

  const played = spyOn(psn, 'playedGames')
  const stored = {
    game: 'game:1',
    seconds: 7200,
    play_count: 3,
    first_played_at: null,
    last_played_at: null,
  }
  spyOn(playtimes, 'listPlaytimes').mockResolvedValue([stored])
  expect((await playtime.playtimes(demo)).get('game:1')).toEqual(stored)
  expect(played).not.toHaveBeenCalled()
})

test('nothing tagged as demo reaches the AI service or PSN', async () => {
  const fetch = spyOn(globalThis, 'fetch')
  const call = tagged({ user: demo.id, demo: true }, () => ai.ai('/nexo/reply', {}))
  expect(call).rejects.toBeInstanceOf(DemoReadOnly)
  const plan = tagged({ user: demo.id, demo: true }, () => planSession(demo, makeContext(), 60))
  expect(plan).rejects.toBeInstanceOf(DemoReadOnly)
  const read = tagged({ demo: true }, () => psn.recentTitles('123'))
  expect(read).rejects.toThrow('psn: not for the demo player')
  await Promise.allSettled([call, plan, read])
  expect(fetch).not.toHaveBeenCalled()
})

test('the demo session opens without a password, and only when a demo is loaded', async () => {
  const one = spyOn(db, 'one').mockResolvedValue(undefined)
  const create = spyOn(db, 'q').mockResolvedValue([])
  expect(await auth.demoSession()).toBeNull()
  one.mockResolvedValue({ id: new db.RecordId('user', 'demo'), demo: true })
  const session = await auth.demoSession()
  expect(session?.user).toEqual({ id: 'user:demo', demo: true } as never)
  expect(session?.token).toMatch(/^[a-f0-9]{64}$/)
  expect(create.mock.calls[0][0]).toStartWith('CREATE auth_session')
})
