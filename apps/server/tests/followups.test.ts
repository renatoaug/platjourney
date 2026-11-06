import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { followUp, followUps } from '../src/followups.ts'
import * as contexts from '../src/game-context.ts'
import * as notify from '../src/notify.ts'
import * as plugins from '../src/plugins.ts'
import * as activity from '../src/repository/activity.ts'
import * as games from '../src/repository/game.ts'
import * as requests from '../src/repository/guide-request.ts'
import * as users from '../src/repository/user.ts'
import { makeContext, makeGame, makeUser } from './fixtures.ts'

afterEach(() => mock.restore())

const waiting = {
  game: 'game:7',
  user: 'user:ana',
  question: 'onde fica a chave?',
  asked_at: '2026-11-04T10:00:00Z',
}

function setup(text: string | null) {
  const user = makeUser({ id: 'user:ana' })
  const game = makeGame({ id: 'game:7' })
  spyOn(users, 'getUser').mockResolvedValue(user)
  spyOn(games, 'getGame').mockResolvedValue(game)
  spyOn(contexts, 'contextForGame').mockResolvedValue(makeContext({ game }))
  spyOn(plugins, 'aroundModel').mockImplementation((_work, run) => run())
  const ai = spyOn(aiModule, 'ai').mockResolvedValue({ text } as never)
  const tip = spyOn(activity, 'logTip').mockResolvedValue()
  const message = spyOn(activity, 'appendMessage').mockResolvedValue()
  const deliver = spyOn(notify, 'deliver').mockResolvedValue()
  const mark = spyOn(requests, 'markQuestion').mockResolvedValue()
  return { user, ai, tip, message, deliver, mark }
}

test('an answer the guide now has reaches the player and closes the question', async () => {
  const { user, ai, tip, message, deliver, mark } = setup('Voltei com a chave: fica no porão.')
  expect(await followUp(waiting)).toBe(true)
  expect(ai.mock.calls[0][0]).toBe('/nexo/follow-up')
  expect(ai.mock.calls[0][1]).toMatchObject({ question: 'onde fica a chave?' })
  expect(tip).toHaveBeenCalledWith(
    'user:ana',
    'answer',
    'Voltei com a chave: fica no porão.',
    'game:7',
  )
  expect(message).toHaveBeenCalledWith(
    'user:ana',
    'assistant',
    'Voltei com a chave: fica no porão.',
    'game:7',
  )
  expect(deliver).toHaveBeenCalledWith(user, 'Voltei com a chave: fica no porão.')
  expect(mark).toHaveBeenCalledWith(waiting, 'notified_at')
})

test('with nothing to say yet, the question waits for the next passages', async () => {
  const { tip, deliver, mark } = setup(null)
  expect(await followUp(waiting)).toBe(false)
  expect(tip).not.toHaveBeenCalled()
  expect(deliver).not.toHaveBeenCalled()
  expect(mark).toHaveBeenCalledWith(waiting, 'checked_at')
})

test('a player or game gone, or a game with no list, is left alone', async () => {
  const { ai, mark } = setup('x')
  spyOn(contexts, 'contextForGame').mockResolvedValue(null)
  expect(await followUp(waiting)).toBe(false)
  spyOn(users, 'getUser').mockResolvedValue(undefined)
  expect(await followUp(waiting)).toBe(false)
  expect(ai).not.toHaveBeenCalled()
  expect(mark).not.toHaveBeenCalled()
})

test('a pass counts the answers sent and a failure does not stop the others', async () => {
  const { ai } = setup('Achei.')
  spyOn(requests, 'waitingQuestions').mockResolvedValue([
    waiting,
    { ...waiting, question: 'e a outra?' },
  ])
  ai.mockRejectedValueOnce(new Error('down'))
  const error = spyOn(console, 'error').mockImplementation(() => {})
  expect(await followUps()).toBe(1)
  expect(error).toHaveBeenCalledTimes(1)
})
