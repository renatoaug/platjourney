import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as psn from '../src/psn.ts'
import { loadGroups, rankNextPlatinum } from '../src/ranking.ts'
import * as games from '../src/repository/game.ts'
import type { TitleRow } from '../src/repository/title.ts'
import * as titles from '../src/repository/title.ts'
import { counts, makeGame, makeGroups, makeTitle, makeUser } from './fixtures.ts'

const user = makeUser()
const title = makeTitle()
const row = (over: Partial<TitleRow> = {}): TitleRow => ({
  id: 'title:t1',
  user: 'user:u1',
  game: 'game:1',
  np_communication_id: title.npCommunicationId,
  name: title.name,
  platform: title.platform,
  icon_url: '',
  progress: title.progress,
  earned: title.earned,
  total: title.total,
  earned_ids: [],
  groups: null,
  last_updated_at: title.lastUpdated,
  last_tip_at: null,
  ...over,
})

afterEach(() => mock.restore())

test('cached groups are used while the title has not changed', async () => {
  const groups = makeGroups()
  spyOn(titles, 'getTitle').mockResolvedValue(row({ groups }))
  const fetch = spyOn(psn, 'titleGroups')
  expect(await loadGroups(title, user)).toBe(groups)
  expect(fetch).not.toHaveBeenCalled()
})

test('a title with nothing earned reuses another player’s groups, blanked', async () => {
  const dlc = {
    earned: 2,
    total: 5,
    remaining: 3,
    earnedByType: counts(2),
    definedByType: counts(4, 1),
  }
  const shared = makeGroups({ dlc })
  spyOn(titles, 'getTitle').mockResolvedValue(undefined)
  const upsert = spyOn(titles, 'upsertTitle').mockResolvedValue(row())
  spyOn(titles, 'sharedGroups').mockResolvedValue(shared)
  const save = spyOn(titles, 'saveGroups').mockResolvedValue(undefined)
  const groups = await loadGroups(makeTitle({ earned: 0 }), user)
  expect(upsert).toHaveBeenCalled()
  expect(groups?.base).toEqual({ ...shared.base, earned: 0, remaining: 9, earnedByType: counts() })
  expect(groups?.dlc).toEqual({ ...dlc, earned: 0, remaining: 5, earnedByType: counts() })
  expect(save).toHaveBeenCalledWith('user:u1', title.npCommunicationId, groups)
})

test('changed titles read their groups from PSN and store them', async () => {
  const groups = makeGroups()
  spyOn(titles, 'getTitle').mockResolvedValue(row({ last_updated_at: '2020-01-01T00:00:00Z' }))
  const upsert = spyOn(titles, 'upsertTitle').mockResolvedValue(row())
  const save = spyOn(titles, 'saveGroups').mockResolvedValue(undefined)
  const fetch = spyOn(psn, 'titleGroups').mockResolvedValue(groups)
  expect(await loadGroups(title, user)).toBe(groups)
  expect(fetch).toHaveBeenCalledWith(title, 'acc1')
  expect(upsert).toHaveBeenCalledWith('user:u1', title)
  expect(save).toHaveBeenCalledWith('user:u1', title.npCommunicationId, groups)
})

test('a title nobody shared groups for is read from PSN', async () => {
  spyOn(titles, 'getTitle').mockResolvedValue(row({ earned: 0 }))
  spyOn(titles, 'sharedGroups').mockResolvedValue(undefined)
  const upsert = spyOn(titles, 'upsertTitle')
  spyOn(titles, 'saveGroups').mockResolvedValue(undefined)
  spyOn(psn, 'titleGroups').mockResolvedValue(makeGroups())
  expect(await loadGroups(makeTitle({ earned: 0 }), user)).toEqual(makeGroups())
  expect(upsert).not.toHaveBeenCalled()
})

test('a PSN failure falls back to the stored groups', async () => {
  spyOn(console, 'error').mockImplementation(() => {})
  const stale = makeGroups()
  spyOn(psn, 'titleGroups').mockRejectedValue(new Error('down'))
  spyOn(titles, 'upsertTitle').mockResolvedValue(row())
  spyOn(titles, 'getTitle')
    .mockResolvedValueOnce(row({ groups: stale, last_updated_at: '2020-01-01T00:00:00Z' }))
    .mockResolvedValueOnce(row({ last_updated_at: '2020-01-01T00:00:00Z' }))
  expect(await loadGroups(title, user)).toBe(stale)
  expect(await loadGroups(title, user)).toBeNull()
})

test('the cheapest platinums come first, refined by the base game split', async () => {
  const t = (np: string, earned: [number, number, number], progress = 50, plat: 0 | 1 = 0) =>
    makeTitle({
      npCommunicationId: np,
      progress,
      definedByType: counts(10, 4, 2, 1),
      earnedByType: counts(...earned, plat),
    })
  const library = [
    t('NEAR', [10, 4, 1]),
    t('FAR', [0, 0, 0], 1),
    t('MID', [8, 4, 2]),
    t('DONE', [10, 4, 2], 100, 1),
    t('UNTOUCHED', [0, 0, 0], 0),
    t('SKIPPED', [10, 4, 2]),
    makeTitle({ npCommunicationId: 'NOPLAT', definedByType: counts(5) }),
  ]
  spyOn(games, 'gameForTitle').mockImplementation((async (x: { npCommunicationId: string }) =>
    makeGame({ id: `game:${x.npCommunicationId}` })) as never)
  spyOn(titles, 'getTitle').mockImplementation((async (_u: string, np: string) =>
    row({
      np_communication_id: np,
      groups:
        np === 'MID'
          ? makeGroups({
              base: {
                earned: 10,
                total: 10,
                remaining: 0,
                earnedByType: counts(6, 2, 1),
                definedByType: counts(6, 2, 1, 1),
              },
            })
          : null,
      last_updated_at: np === 'MID' ? title.lastUpdated : '2020-01-01T00:00:00Z',
    })) as never)
  spyOn(console, 'error').mockImplementation(() => {})
  spyOn(titles, 'upsertTitle').mockResolvedValue(row())
  spyOn(psn, 'titleGroups').mockRejectedValue(new Error('down'))
  const ranked = await rankNextPlatinum(library, user, 2, ['SKIPPED'])
  expect(ranked.map((r) => [r.game.id, r.remaining, r.effort, r.baseProgress])).toEqual([
    ['game:MID', 0, 0, 100],
    ['game:NEAR', 1, 4, 50],
  ])
})
