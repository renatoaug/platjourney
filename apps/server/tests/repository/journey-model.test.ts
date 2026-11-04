import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import {
  getJourneyModel,
  importJourneyModel,
  journeyChecksum,
  publishJourneyModel,
} from '../../src/repository/journey-model.ts'
import { requiem } from '../journey-fixtures.ts'

afterEach(() => mock.restore())
const stored = () => ({
  game: db.gameId('game:1'),
  payload: db.snakeKeys(requiem),
  edition: requiem.edition,
  version: requiem.version,
  checksum: journeyChecksum(requiem),
})
test('reads validated snake_case knowledge only for the requested game and edition', async () => {
  const one = spyOn(db, 'one').mockResolvedValue({ model: stored() })
  expect(await getJourneyModel('game:1', requiem.edition)).toEqual(requiem)
  expect(one.mock.calls[0][1]).toEqual({ game: db.gameId('game:1'), edition: requiem.edition })
  one.mockClear()
  expect(await getJourneyModel('game:1')).toBeUndefined()
  expect(one).not.toHaveBeenCalled()
  one.mockResolvedValue(undefined)
  expect(await getJourneyModel('game:1', requiem.edition)).toBeUndefined()
  one.mockResolvedValue({ model: null })
  expect(await getJourneyModel('game:1', requiem.edition)).toBeUndefined()
})
test('invalid, tampered and cross-edition publications fail explicitly instead of recommending', async () => {
  const one = spyOn(db, 'one')
  for (const bad of [
    { ...stored(), checksum: 'bad' },
    { ...stored(), version: 9 },
    { ...stored(), edition: 'OTHER' },
    { ...stored(), game: db.gameId('game:2') },
    { ...stored(), payload: {} },
  ]) {
    one.mockResolvedValue({ model: bad })
    await expect(getJourneyModel('game:1', requiem.edition)).rejects.toThrow()
  }
})
test('checksum ignores formatting but detects guidance changes', () => {
  expect(journeyChecksum({ ...requiem, name: 'Changed' })).not.toBe(journeyChecksum(requiem))
  const reversed = Object.fromEntries(Object.entries(requiem).reverse())
  expect(journeyChecksum(reversed as typeof requiem)).toBe(journeyChecksum(requiem))
})
test('import validates before touching storage, stages snake_case and never publishes', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await expect(importJourneyModel('game:1', {})).rejects.toThrow()
  expect(q).not.toHaveBeenCalled()
  expect(await importJourneyModel('game:1', requiem)).toEqual(requiem)
  expect(q.mock.calls[0][0]).toContain('BEGIN TRANSACTION')
  expect(q.mock.calls[0][0]).not.toContain('UPSERT journey_publication')
  expect(q.mock.calls[0][1]?.payload).toEqual(db.snakeKeys(requiem))
})
test('activation checks the staged target and carries the expected previous version; null deactivates', async () => {
  const one = spyOn(db, 'one').mockResolvedValue(undefined)
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await expect(publishJourneyModel('game:1', requiem.edition, 2, null)).rejects.toThrow('Import')
  expect(q).not.toHaveBeenCalled()
  one.mockResolvedValue(stored())
  await publishJourneyModel('game:1', requiem.edition, 2, 1)
  expect(q.mock.calls[0][1]).toMatchObject({ expected: 1, version: 2 })
  one.mockClear()
  await publishJourneyModel('game:1', requiem.edition, null, 2)
  expect(one).not.toHaveBeenCalled()
  expect(q.mock.calls[1][1]).toMatchObject({ expected: 2, version: null, model: null })
})
