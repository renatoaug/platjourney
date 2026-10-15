import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { interestsWithStore } from '../../src/repository/store-price.ts'

afterEach(() => mock.restore())

test('a saved game reaches only who saved it and does not own it yet', async () => {
  spyOn(db, 'q')
    .mockResolvedValueOnce([
      { game: 'game:1', name: 'Days Gone', store_url: 'u1', users: ['user:a', 'user:b'] },
      { game: 'game:2', name: 'Inside', store_url: 'u2', users: ['user:a'] },
    ])
    .mockResolvedValueOnce([{ game: 'game:1', users: ['user:b'] }])
  expect(await interestsWithStore()).toEqual([
    { game: 'game:1', name: 'Days Gone', store_url: 'u1', users: ['user:a'] },
    { game: 'game:2', name: 'Inside', store_url: 'u2', users: ['user:a'] },
  ])
})

test('a saved game the player said they already have is left out of the deals', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([])
  await interestsWithStore()
  expect(String(q.mock.calls[0][0])).toContain('owned_at = NONE')
})
