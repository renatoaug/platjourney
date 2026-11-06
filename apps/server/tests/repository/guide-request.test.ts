import '../env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../../src/db.ts'
import { markAnswered, requestGuide, waitingQuestions } from '../../src/repository/guide-request.ts'

const game = new db.RecordId('game', 7)
const user = new db.RecordId('user', 'ana')

afterEach(() => mock.restore())

test('a request is one per player: the count is the players who asked', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  await requestGuide('game:7', 'user:ana')
  expect(q.mock.calls[0][0]).toContain('users = array::union(users ?? [], [$user])')
  expect(q.mock.calls[0][0]).toContain('requests = array::len(array::union(users ?? [], [$user]))')
  expect(q.mock.calls[0][0]).toContain(
    'CREATE guide_request SET game = $game, users = [$user], requests = 1',
  )
  expect(q.mock.calls[0][1]).toEqual({ game, user })
})

test('the open questions come oldest first, with their game and who asked', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([
    {
      game,
      name: 'Ecos de Vidro',
      questions: [
        { question: 'onde fica a chave?', user, asked_at: '2026-11-04T10:00:00Z' },
        { question: 'quantas moedas?', user, asked_at: '2026-11-01T10:00:00Z' },
      ],
    },
    { game: new db.RecordId('game', 8), name: null, questions: null },
  ] as never)
  expect(await waitingQuestions()).toEqual([
    {
      game: 'game:7',
      name: 'Ecos de Vidro',
      user: 'user:ana',
      question: 'quantas moedas?',
      asked_at: '2026-11-01T10:00:00Z',
    },
    {
      game: 'game:7',
      name: 'Ecos de Vidro',
      user: 'user:ana',
      question: 'onde fica a chave?',
      asked_at: '2026-11-04T10:00:00Z',
    },
  ])
  expect(q.mock.calls[0][0]).toContain('answered = false AND notified_at = NONE')
})

test('an answered question is marked by its time, text and player inside its game', async () => {
  const q = spyOn(db, 'q').mockResolvedValue(undefined)
  const w = {
    game: 'game:7',
    user: 'user:ana',
    question: 'onde?',
    asked_at: '2026-11-04T10:00:00Z',
  }
  await markAnswered(w)
  expect(q.mock.calls[0][0]).toContain('$x + { notified_at: time::now() }')
  expect(q.mock.calls[0][1]).toEqual({ game, user, question: 'onde?', at: w.asked_at })
})
