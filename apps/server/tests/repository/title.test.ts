import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import * as games from '../../src/repository/game.ts'
import {
  getTitle,
  markTipSent,
  saveEarnedIds,
  saveGroups,
  sharedGroups,
  upsertTitle,
} from '../../src/repository/title.ts'
import { makeGame, makeGroups, makeTitle } from '../fixtures.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 1)

afterEach(() => mock.restore())

test('a title row is read by user and list id', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ id: new db.RecordId('title', 't1'), game })
  expect(await getTitle('user:u1', 'NP')).toEqual({ id: 'title:t1', game: 'game:1' } as never)
  expect(one.mock.calls[0]).toEqual([
    'SELECT * FROM title WHERE user = $user AND np_communication_id = $np LIMIT 1',
    { user, np: 'NP' },
  ])
})

test('shared groups come from any row of the same list and size', async () => {
  const groups = makeGroups()
  const one = spyOn(db, 'one').mockResolvedValueOnce({ groups }).mockResolvedValueOnce(undefined)
  expect(await sharedGroups('NP', 20)).toEqual(groups)
  expect(await sharedGroups('NP', 20)).toBeUndefined()
  expect(one.mock.calls[0][0]).toContain('groups != NONE')
  expect(one.mock.calls[0][1]).toEqual({ np: 'NP', total: 20 })
})

const expectedData = {
  user,
  game,
  np_communication_id: 'NPWR1_00',
  name: 'Days Gone',
  platform: 'PS4',
  icon_url: 'icon.png',
  progress: 50,
  earned: 10,
  total: 20,
  last_updated_at: new Date('2026-05-01T10:00:00.000Z'),
}

test('a new title is created linked to its catalog game', async () => {
  spyOn(games, 'gameForTitle').mockResolvedValue(makeGame())
  const one = spyOn(db, 'one')
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ id: new db.RecordId('title', 'new') })
  expect(await upsertTitle('user:u1', makeTitle())).toEqual({ id: 'title:new' } as never)
  expect(one.mock.calls[1]).toEqual([
    'CREATE title CONTENT $data RETURN AFTER',
    { data: expectedData },
  ])
})

test('a known title is merged into its existing row', async () => {
  spyOn(games, 'gameForTitle').mockResolvedValue(makeGame())
  const one = spyOn(db, 'one')
    .mockResolvedValueOnce({ id: new db.RecordId('title', 'old') })
    .mockResolvedValueOnce({ id: new db.RecordId('title', 'old'), earned: 10 })
  expect(await upsertTitle('user:u1', makeTitle())).toEqual({
    id: 'title:old',
    earned: 10,
  } as never)
  expect(one.mock.calls[1]).toEqual([
    'UPDATE $id MERGE $data RETURN AFTER',
    { id: new db.RecordId('title', 'old'), data: expectedData },
  ])
})

test('earned ids, the tip mark and groups are written to the title row', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  const groups = makeGroups()
  await saveEarnedIds('user:u1', 'NP', [1, 2])
  await markTipSent('user:u1', 'NP')
  await saveGroups('user:u1', 'NP', groups)
  expect(q.mock.calls).toEqual([
    [
      'UPDATE title SET earned_ids = $ids WHERE user = $user AND np_communication_id = $np',
      { user, np: 'NP', ids: [1, 2] },
    ],
    [
      'UPDATE title SET last_tip_at = time::now() WHERE user = $user AND np_communication_id = $np',
      { user, np: 'NP' },
    ],
    [
      'UPDATE title SET groups = $groups WHERE user = $user AND np_communication_id = $np',
      { user, np: 'NP', groups: db.snakeKeys(groups) },
    ],
  ])
})

test('a title row reads its split and stored list in camelCase', async () => {
  spyOn(db, 'one').mockResolvedValue({
    id: 'title:t1',
    groups: { base: { defined_by_type: { gold: 1 } }, dlc_names: {} },
    trophies: [{ earned_at: 'x', icon_url: 'i' }],
  })
  expect(await getTitle('user:u1', 'NP')).toMatchObject({
    groups: { base: { definedByType: { gold: 1 } }, dlcNames: {} },
    trophies: [{ earnedAt: 'x', iconUrl: 'i' }],
  })
})
