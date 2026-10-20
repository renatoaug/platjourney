import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { dropPick, picksOf, prunePicks, savePick } from '../../src/repository/assistant-pick.ts'

const user = new db.RecordId('user', 'u1')
const game = new db.RecordId('game', 7)

afterEach(() => mock.restore())

test('a suggestion is one row a game: suggesting it again updates it', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await savePick('user:u1', 'game:7', 'Short and fun.', 'Claude')
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain('UPSERT assistant_pick SET user = $user, game = $game')
  expect(sql).toContain('WHERE user = $user AND game = $game')
  expect(vars).toEqual({ user, game, reason: 'Short and fun.', assistant: 'Claude' })
})

test('the suggestions shown leave out old ones, saved games and dismissed ones', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([
    { id: new db.RecordId('assistant_pick', 'a'), game: { id: game, name: 'X' }, reason: 'r' },
  ])
  const picks = await picksOf('user:u1', 2026)
  const [sql, vars] = q.mock.calls[0]
  expect(sql).toContain('updated_at > time::now() - 30d')
  expect(sql).toContain('game NOTINSIDE $saved AND game NOTINSIDE $dismissed')
  expect(vars).toEqual({ user, year: 2026 })
  expect(picks[0]).toMatchObject({ id: 'assistant_pick:a', game: { id: 'game:7' } })
})

test('a suggestion is dropped by its game; old ones are pruned', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([{}])
  expect(await dropPick('user:u1', 'game:7')).toBe(true)
  expect(q.mock.calls[0][1]).toEqual({ user, game })
  q.mockResolvedValue([])
  expect(await dropPick('user:u1', 'game:7')).toBe(false)
  await prunePicks()
  expect(q.mock.calls[2][0]).toBe('DELETE assistant_pick WHERE updated_at < time::now() - 30d')
})
