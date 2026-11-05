import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { Readable } from 'node:stream'
import * as gameContext from '../src/game-context.ts'
import * as lib from '../src/library.ts'
import * as nexo from '../src/nexo.ts'
import * as nextPicks from '../src/next-pick.ts'
import * as activity from '../src/repository/activity.ts'
import * as games from '../src/repository/game.ts'
import * as interests from '../src/repository/interest.ts'
import * as platinums from '../src/repository/platinum.ts'
import * as similar from '../src/repository/similar.ts'
import { CHAT_ROUTES } from '../src/routes/chat.ts'
import * as watcher from '../src/watcher.ts'
import { makeGame, makeTitle, makeUser } from './api-fixtures.ts'

afterEach(() => mock.restore())

const pick = {
  id: 'p1',
  game: { id: 'game:9', name: 'Stray', cover_url: 'c.jpg' },
  why: 'Curto e calmo.',
  firstStep: 'Comece pelo capítulo 1.',
  mood: null,
  scope: 'interests',
  ownedOnly: false,
  fits: true,
  recommender: 'nexo',
  at: '',
} as never

async function send(text: string, general?: boolean) {
  let body: Record<string, unknown> = {}
  const res = Object.assign(
    {
      setHeader() {},
      writeHead() {
        return res
      },
      end(raw: string) {
        body = JSON.parse(raw)
      },
    },
    {},
  )
  await CHAT_ROUTES['POST /api/chat']({
    req: Object.assign(Readable.from([JSON.stringify({ text, general })]), { headers: {} }),
    res,
    me: makeUser(),
    titles: async () => [makeTitle({ npCommunicationId: 'NP9', progress: 30 })],
  } as never)
  return body
}

let append: ReturnType<typeof spyOn>
let answer: ReturnType<typeof spyOn>
let picks: ReturnType<typeof spyOn>
beforeEach(() => {
  append = spyOn(activity, 'appendMessage').mockResolvedValue(undefined)
  spyOn(activity, 'logTip').mockResolvedValue(undefined as never)
  spyOn(activity, 'recentMessages').mockResolvedValue([])
  spyOn(watcher, 'chatOrCheck').mockResolvedValue(undefined)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(gameContext, 'getChat').mockReturnValue(undefined)
  spyOn(games, 'getGame').mockResolvedValue(
    makeGame({ id: 'game:9', art_url: 'a.jpg', np_communication_ids: ['NP9'] }),
  )
  spyOn(similar, 'guideFacts').mockResolvedValue([{ game: 'game:9', difficulty: 2, hours: 10 }])
  answer = spyOn(nexo, 'reply').mockResolvedValue('resposta normal')
  picks = spyOn(nextPicks, 'nextPick').mockResolvedValue(pick)
  spyOn(platinums, 'listPlatinums').mockResolvedValue([])
  spyOn(interests, 'listInterests').mockResolvedValue([])
})

for (const question of [
  'O que platinar agora?',
  'o que devo jogar hoje',
  'Qual jogo platinar?',
  'qual a minha próxima platina',
  'What should I platinum now?',
])
  test(`"${question}" gets the real recommendation with its card`, async () => {
    const body = await send(question)
    expect(answer).not.toHaveBeenCalled()
    expect(body.text).toContain('Curto e calmo.')
    expect(body.text).toContain('Comece pelo capítulo 1.')
    expect(append.mock.calls[1][4]).toMatchObject({
      kind: 'game',
      game: 'game:9',
      name: 'Stray',
      artUrl: 'a.jpg',
      difficulty: 2,
      hours: 10,
      progress: 30,
    })
  })

for (const question of [
  'como faço esse troféu?',
  'o jogo tem online?',
  'Sobre o troféu **O que jogar**: como faço?',
])
  test(`"${question}" stays an ordinary answer`, async () => {
    expect((await send(question)).text).toBe('resposta normal')
    expect(picks).not.toHaveBeenCalled()
  })

test('the pick goes to the general conversation even from a game', async () => {
  const body = await send('o que platinar agora?')
  expect(body.general).toBe(true)
  expect(append.mock.calls[0][3]).toBeUndefined()
  expect(append.mock.calls[1][3]).toBeUndefined()
  expect(watcher.chatOrCheck).not.toHaveBeenCalled()
})

test('a general message goes with the facts about the player and no game', async () => {
  const year = new Date().getFullYear()
  spyOn(platinums, 'listPlatinums').mockResolvedValue([
    { game: { name: 'Stray' }, trophy_name: 'Fim', earned_at: `${year}-01-02` },
    { game: { name: 'Hades' }, trophy_name: 'Fim', earned_at: `${year - 1}-01-02` },
  ] as never)
  spyOn(interests, 'listInterests').mockResolvedValue([{ game: { name: 'Celeste' } }] as never)
  const body = await send('como está minha meta?', true)
  expect(body.general).toBe(true)
  expect(watcher.chatOrCheck).not.toHaveBeenCalled()
  expect(answer.mock.calls[0][2]).toBeUndefined()
  expect(answer.mock.calls[0][3]).toMatchObject({
    platinums: 2,
    platinumsThisYear: 1,
    latestPlatinums: ['Stray', 'Hades'],
    interests: ['Celeste'],
  })
})

test('with no saved game it picks from any game', async () => {
  picks.mockResolvedValueOnce(null)
  await send('o que platinar agora?')
  expect(picks.mock.calls[0][3]).toEqual({ scope: 'interests' })
  expect(picks.mock.calls[1][3]).toEqual({ scope: 'any' })
})

test('when nothing can be picked the chat answers instead', async () => {
  picks.mockResolvedValue(null)
  expect((await send('o que platinar agora?')).text).toBe('resposta normal')
})
