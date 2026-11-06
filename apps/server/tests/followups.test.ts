import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { followUpAnswer, sendFollowUp } from '../src/followups.ts'
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
  return { user, ai }
}

test("Nexo writes the answer from the game's guide, or nothing while it has none", async () => {
  const { ai } = setup('Voltei com a chave: fica no porão.')
  expect(await followUpAnswer(waiting)).toBe('Voltei com a chave: fica no porão.')
  expect(ai.mock.calls[0][0]).toBe('/nexo/follow-up')
  expect(ai.mock.calls[0][1]).toMatchObject({ question: 'onde fica a chave?' })
  ai.mockResolvedValue({ text: null } as never)
  expect(await followUpAnswer(waiting)).toBeNull()
})

test('a player or game gone, or a game with no list, gets no answer', async () => {
  const { ai } = setup('x')
  spyOn(contexts, 'contextForGame').mockResolvedValue(null)
  expect(await followUpAnswer(waiting)).toBeNull()
  spyOn(users, 'getUser').mockResolvedValue(undefined)
  expect(await followUpAnswer(waiting)).toBeNull()
  expect(ai).not.toHaveBeenCalled()
})

test('a sent answer is a notice, joins the conversation and closes the question', async () => {
  const { user } = setup(null)
  const tip = spyOn(activity, 'logTip').mockResolvedValue()
  const message = spyOn(activity, 'appendMessage').mockResolvedValue()
  const deliver = spyOn(notify, 'deliver').mockResolvedValue()
  const mark = spyOn(requests, 'markAnswered').mockResolvedValue()
  await sendFollowUp(waiting, 'Fica no porão.')
  expect(tip).toHaveBeenCalledWith('user:ana', 'answer', 'Fica no porão.', 'game:7')
  expect(message).toHaveBeenCalledWith('user:ana', 'assistant', 'Fica no porão.', 'game:7')
  expect(deliver).toHaveBeenCalledWith(user, 'Fica no porão.')
  expect(mark).toHaveBeenCalledWith(waiting)
  spyOn(users, 'getUser').mockResolvedValue(undefined)
  expect(sendFollowUp(waiting, 'x')).rejects.toThrow('no player')
})
