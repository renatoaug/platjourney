import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { requestMissingGame } from '../../src/repository/game-request.ts'

const user = new db.RecordId('user', 'u1')

afterEach(() => mock.restore())

test('asking for a missing game adds the account once under its search key', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(false)
  expect(await requestMissingGame('Jogo Exemplo™: Edição', 'user:u1')).toBe(false)
  const sql = q.mock.calls[0][0]
  expect(sql).toContain('$user IN $row.users { RETURN true }')
  expect(sql).toContain('users += $user, requests = array::len($row.users) + 1')
  expect(sql).toContain(
    'CREATE game_request SET key = $key, name = $name, users = [$user], requests = 1',
  )
  expect(q.mock.calls[0][1]).toEqual({
    key: 'jogo exemplo edicao',
    name: 'Jogo Exemplo™: Edição',
    user,
  })
})

test('an account asking again is told so', async () => {
  spyOn(db, 'q').mockResolvedValue(true)
  expect(await requestMissingGame('Jogo Exemplo', 'user:u1')).toBe(true)
})

test('a name with nothing searchable in it is not kept', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(false)
  expect(await requestMissingGame('™ — ®', 'user:u1')).toBe(false)
  expect(q).not.toHaveBeenCalled()
})
