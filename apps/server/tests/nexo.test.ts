import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { currentTag } from '../src/costs.ts'
import type { GameContext } from '../src/nexo.ts'
import { proactiveTip, reply, trophyHelp, unlockReaction, withoutTitle } from '../src/nexo.ts'
import * as plugins from '../src/plugins.ts'
import * as activity from '../src/repository/activity.ts'
import { makeContext, makeTrophy, makeUser } from './fixtures.ts'

const user = makeUser()
const ctx = makeContext()
const context = {
  game: ctx.game,
  title: ctx.title,
  trophies: ctx.trophies,
  guide: null,
  groups: null,
  hoursPlayed: null,
  includeDlcProgress: false,
  owned: true,
  locale: 'pt-BR',
}

let ai: ReturnType<typeof spyOn<typeof aiModule, 'ai'>>
let logTip: ReturnType<typeof spyOn<typeof activity, 'logTip'>>
let append: ReturnType<typeof spyOn<typeof activity, 'appendMessage'>>
let around: ReturnType<typeof spyOn<typeof plugins, 'aroundModel'>>
const tags: unknown[] = []

beforeEach(() => {
  tags.length = 0
  ai = spyOn(aiModule, 'ai').mockImplementation((async () => {
    tags.push(currentTag())
    return { text: 'Resposta' }
  }) as never)
  around = spyOn(plugins, 'aroundModel')
  logTip = spyOn(activity, 'logTip').mockResolvedValue(undefined)
  append = spyOn(activity, 'appendMessage').mockResolvedValue(undefined)
  spyOn(activity, 'recentMessages').mockResolvedValue([
    { id: 'm1', role: 'user', content: 'oi', created_at: '2026-01-01T10:00:00Z' },
    { id: 'm2', role: 'assistant', content: 'olá', created_at: '2026-01-01T10:02:00Z' },
  ])
  spyOn(activity, 'recentNotifications').mockResolvedValue([
    {
      id: 'n1',
      kind: 'unlock',
      content: 'Troféu!',
      game: ctx.game,
      read_at: null,
      created_at: '2026-01-01T10:01:00Z',
    },
    {
      id: 'n2',
      kind: 'server',
      content: 'Servidor',
      game: null,
      read_at: null,
      created_at: '2026-01-01T09:00:00Z',
    },
  ])
})

afterEach(() => mock.restore())

test('a start tip goes through the plugins, tagged and logged', async () => {
  expect(await proactiveTip(user, ctx)).toBe('Resposta')
  expect(around.mock.calls[0][0]).toEqual({ user, action: 'tip' })
  expect(ai).toHaveBeenCalledWith('/nexo/tip', { kind: 'start', context })
  expect(tags[0]).toEqual({ user: 'user:u1', action: 'tip' })
  expect(logTip).toHaveBeenCalledWith('user:u1', 'start', 'Resposta', 'game:1')
  expect(append).not.toHaveBeenCalled()
})

test('an unlock reaction sends the trophies just earned, and opens with them as its title', async () => {
  const unlocked = [makeTrophy({ earned: true })]
  const text = await unlockReaction(user, ctx, unlocked)
  expect(ai).toHaveBeenCalledWith('/nexo/tip', { kind: 'unlock', context, unlocked })
  expect(text).toBe(`🏆 **${unlocked[0].name}**\n\nResposta`)
  expect(logTip).toHaveBeenCalledWith('user:u1', 'unlock', text, 'game:1')
})

test('the collectibles go after Nexo’s words as written, never through the model', async () => {
  const unlocked = [makeTrophy({ earned: true })]
  const block = '📍 **Neste trecho do jogo**\n• **Flor 2/5, Camomila**\nNa árvore com vasos.'
  const text = await unlockReaction(user, ctx, unlocked, undefined, block)
  expect(ai).toHaveBeenCalledWith('/nexo/tip', { kind: 'unlock', context, unlocked })
  expect(text).toBe(`🏆 **${unlocked[0].name}**\n\nResposta\n\n${block}`)
  expect(await proactiveTip(user, ctx, undefined, undefined, block)).toBe(`Resposta\n\n${block}`)
})

test('with the next chapter’s checklist, a focus that is only its story trophy is left out; the relief goes under the trophy', async () => {
  const chapters = makeContext({
    trophies: [
      makeTrophy({ id: 1, name: 'Capítulo 4', earned: true }),
      makeTrophy({ id: 2, name: 'Capítulo 5' }),
      // Far from any mark (first, halfway, final stretch), so no cheer of its own.
      makeTrophy({ id: 3, name: 'Primeiro', earned: true }),
      ...Array.from({ length: 12 }, (_, i) => makeTrophy({ id: 10 + i, name: `Extra ${i}` })),
    ],
    guide: {
      roadmap: [{ phase: 'História', goal: '', trophies: ['Capítulo 4', 'Capítulo 5'] }],
      milestones: [
        { after: null, tips: [] },
        { after: 'Capítulo 4', tips: [] },
        { after: 'Capítulo 5', tips: [] },
      ],
    } as unknown as GameContext['guide'],
  })
  const unlocked = [chapters.trophies[0]]
  const relief = '🔒 **Capítulo 4** era perdível.'
  const text = await unlockReaction(user, chapters, unlocked, undefined, 'checklist', relief)
  expect((ai.mock.calls[0][1] as { focus?: unknown }).focus).toBeUndefined()
  expect(text).toBe(`🏆 **Capítulo 4**\n\n${relief}\n\nResposta\n\nchecklist`)
  ai.mockClear()
  await unlockReaction(user, chapters, unlocked)
  expect((ai.mock.calls[0][1] as { focus?: { trophy?: string } }).focus?.trophy).toBe('Capítulo 5')
})

test('an unlock reaction drops the trophy name Nexo repeats as a heading', () => {
  expect(withoutTitle('## Fogo Cruzado\n\nMandou bem.', ['Fogo Cruzado'])).toBe('Mandou bem.')
  expect(withoutTitle('**Fogo Cruzado**\nMandou bem.', ['Fogo Cruzado'])).toBe('Mandou bem.')
  expect(withoutTitle('Fogo Cruzado saiu cedo.', ['Fogo Cruzado'])).toBe('Fogo Cruzado saiu cedo.')
})

test('trophy help is stored in the chat so the player can follow up', async () => {
  const trophy = makeTrophy({ name: 'Mestre' })
  await trophyHelp(user, ctx, trophy)
  expect(ai).toHaveBeenCalledWith('/nexo/trophy-help', { context, trophy })
  expect(tags[0]).toEqual({ user: 'user:u1', action: 'chat' })
  expect(append.mock.calls).toEqual([
    ['user:u1', 'user', 'Dica para o troféu **Mestre**', 'game:1'],
    ['user:u1', 'assistant', 'Resposta', 'game:1'],
  ])
  expect(logTip).toHaveBeenCalledWith('user:u1', 'chat', 'Resposta', 'game:1')
})

test('a reply carries the conversation with notices in time order', async () => {
  await reply(user, 'e agora?', ctx)
  expect(ai).toHaveBeenCalledWith('/nexo/reply', {
    text: 'e agora?',
    context,
    history: [
      { role: 'assistant', content: '(Aviso automático) Servidor' },
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: '(Aviso automático sobre Days Gone) Troféu!' },
      { role: 'assistant', content: 'olá' },
    ],
    locale: 'pt-BR',
  })
  expect(append.mock.calls).toEqual([
    ['user:u1', 'user', 'e agora?', 'game:1'],
    ['user:u1', 'assistant', 'Resposta', 'game:1'],
  ])
})

test('a reply without a game sends no context', async () => {
  await reply(user, 'oi')
  expect(ai.mock.calls[0][1]).toMatchObject({ text: 'oi', context: null })
  expect(logTip).toHaveBeenCalledWith('user:u1', 'chat', 'Resposta', undefined)
})

test('a message moderation refuses gets a notice, nothing stored', async () => {
  ai.mockRejectedValue(new aiModule.AiError(422, 'ai /nexo/reply: 422 moderated'))
  expect(await reply(user, 'algo ofensivo', ctx)).toContain('não posso responder')
  expect(append).not.toHaveBeenCalled()
  expect(logTip).not.toHaveBeenCalled()
})

test('any other failure of the service still fails the reply', async () => {
  ai.mockRejectedValue(new aiModule.AiError(500, 'down'))
  await expect(reply(user, 'oi', ctx)).rejects.toThrow('down')
})
