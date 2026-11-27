import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { getGuide, guideSummaries, saveGuide } from '../../src/repository/guide.ts'

const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('a stored guide is read by its game', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ guide_pt: { hours: 30 } })
  expect(await getGuide<{ hours: number }>('game:7')).toEqual({ hours: 30 })
  expect(one.mock.calls[0]).toEqual([
    'SELECT guide_pt, guide_en FROM guide WHERE game = $game LIMIT 1',
    { game },
  ])
})

test('each reader gets the guide in their language', async () => {
  spyOn(db, 'one').mockResolvedValue({
    guide_pt: { hours: 30, overview: 'Tranquilo.' },
    guide_en: { hours: 30, overview: 'Easy.' },
  })
  expect(await getGuide('game:7', 'en')).toEqual({ hours: 30, overview: 'Easy.' })
  expect(await getGuide('game:7', 'pt-BR')).toEqual({ hours: 30, overview: 'Tranquilo.' })
  // No language (what matches trophies by name) reads the Portuguese one.
  expect(await getGuide('game:7')).toMatchObject({ overview: 'Tranquilo.' })
})

test('a language without its guide reads the other one', async () => {
  spyOn(db, 'one').mockResolvedValue({ guide_pt: { overview: 'Tranquilo.' } })
  expect(await getGuide('game:7', 'en')).toEqual({ overview: 'Tranquilo.' })
  mock.restore()
  spyOn(db, 'one').mockResolvedValue({ guide_en: { overview: 'Easy.' } })
  expect(await getGuide('game:7', 'pt-BR')).toEqual({ overview: 'Easy.' })
})

test('a game without a guide reads as undefined', async () => {
  spyOn(db, 'one').mockResolvedValue(undefined)
  expect(await getGuide('game:7')).toBeUndefined()
})

test('a guide is saved in its language, and the other one is marked outdated, not dropped', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveGuide('7', { hours: 30 })
  expect(q.mock.calls[0][0]).toContain('UPSERT guide SET game = $game, guide_pt = $guide')
  expect(q.mock.calls[0][0]).toContain('outdated = IF guide_en != NONE { $other }')
  expect(q.mock.calls[0][1]).toEqual({ game, guide: { hours: 30 }, other: 'en' })
  await saveGuide('7', { hours: 30 }, 'en')
  expect(q.mock.calls[1][0]).toContain('guide_en = $guide')
  expect(q.mock.calls[1][1]).toMatchObject({ other: 'pt-BR' })
})

test('guide summaries read the quick facts of stored guides, in either language', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{ game: 'game:1', has_missables: true }])
  expect(await guideSummaries()).toEqual([{ game: 'game:1', hasMissables: true } as never])
  expect(q.mock.calls[0][0]).toContain('guide_pt ?? guide_en AS g')
})

test('a guide is stored with snake_case keys and read back in camelCase', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await saveGuide('game:7', { hasMissables: true, earlyTips: ['a'] })
  expect(q.mock.calls[0][1]).toMatchObject({
    game,
    guide: { has_missables: true, early_tips: ['a'] },
  })
  spyOn(db, 'one').mockResolvedValue({
    guide_pt: { has_missables: true, point_of_no_return: null },
  })
  expect(await getGuide<unknown>('game:7')).toEqual({ hasMissables: true, pointOfNoReturn: null })
})
