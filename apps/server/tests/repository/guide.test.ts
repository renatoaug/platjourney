import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { getGuide, guideSummaries, saveGuide } from '../../src/repository/guide.ts'

const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('a stored guide is read by its game', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ guide: { hours: 30 } })
  expect(await getGuide<{ hours: number }>('game:7')).toEqual({ hours: 30 })
  expect(one.mock.calls[0]).toEqual([
    'SELECT guide FROM guide WHERE game = $game LIMIT 1',
    { game },
  ])
})

test('a game without a guide reads as undefined', async () => {
  spyOn(db, 'one').mockResolvedValue(undefined)
  expect(await getGuide('game:7')).toBeUndefined()
})

test('a guide is upserted by its game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveGuide('7', { hours: 30 })
  expect(q.mock.calls[0][0]).toContain('UPSERT guide SET game = $game')
  expect(q.mock.calls[0][1]).toEqual({ game, guide: { hours: 30 } })
})

test('guide summaries read the quick facts of stored guides', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: 'game:1', has_missables: true }])
  expect(await guideSummaries()).toEqual([{ game: 'game:1', hasMissables: true } as never])
  expect(q.mock.calls[0][0]).toContain('FROM guide WHERE guide != NONE')
})

test('a guide is stored with snake_case keys and read back in camelCase', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveGuide('game:7', { hasMissables: true, earlyTips: ['a'] })
  expect(q.mock.calls[0][1]).toEqual({ game, guide: { has_missables: true, early_tips: ['a'] } })
  spyOn(db, 'one').mockResolvedValue({ guide: { has_missables: true, point_of_no_return: null } })
  expect(await getGuide<unknown>('game:7')).toEqual({ hasMissables: true, pointOfNoReturn: null })
})
