import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { handleCommand, help } from '../src/commands.ts'
import type { Guide } from '../src/guide.ts'
import * as guide from '../src/guide.ts'
import * as interests from '../src/interests.ts'
import * as lib from '../src/library.ts'
import * as nextPickModule from '../src/next-pick.ts'
import * as planner from '../src/planner.ts'
import * as ranking from '../src/ranking.ts'
import * as recommend from '../src/recommend.ts'
import * as servers from '../src/servers.ts'
import * as telegram from '../src/telegram.ts'
import * as watcher from '../src/watcher.ts'
import { makeContext, makeGame, makeTitle, makeTrophy, makeUser } from './api-fixtures.ts'

const user = makeUser()
const linked = makeUser({ telegram_chat_id: '42' })
const titles = [makeTitle(), makeTitle({ npCommunicationId: 'NPWR2', name: 'Ghost of Tsushima' })]
let send: ReturnType<typeof spyOn>

beforeEach(() => {
  send = spyOn(telegram, 'sendMessage').mockResolvedValue()
  spyOn(watcher, 'getChat').mockReturnValue(undefined)
  spyOn(lib, 'library').mockResolvedValue(titles)
  spyOn(lib, 'ownedGames').mockResolvedValue([])
})

afterEach(() => mock.restore())

test('start greets the player by PSN id with the help', async () => {
  expect(await handleCommand(user, '/start')).toStartWith('Fala, Kratos!')
  expect(await handleCommand(user, '/help')).toBe(help('pt-BR'))
})

test('unknown commands get no reply', async () => {
  expect(await handleCommand(user, '/nope')).toBeUndefined()
})

test('game commands wait for the profile to load', async () => {
  for (const cmd of ['/status', '/guide', '/plan'])
    expect(await handleCommand(user, cmd)).toBe(
      'Ainda não carreguei seu perfil. Tenta em 1 minuto.',
    )
})

test('status lists the most common missing trophies', async () => {
  spyOn(watcher, 'getChat').mockReturnValue(
    makeContext({
      trophies: [
        makeTrophy({ name: 'Raro', earnedRate: 2 }),
        makeTrophy({ name: 'Feito', earned: true }),
        makeTrophy({ name: 'Comum', earnedRate: 80 }),
      ],
    }),
  )
  expect(await handleCommand(user, '/status')).toBe(
    [
      'Days Gone: 50% (5/10)',
      'Faltam 2. Mais comuns entre os que faltam:',
      '• Comum: Leia a carta (80%)',
      '• Raro: Leia a carta (2%)',
    ].join('\n'),
  )
})

test('guide sums up the guide, or says it is not ready', async () => {
  spyOn(watcher, 'getChat').mockReturnValue(makeContext())
  expect(await handleCommand(user, '/guide')).toBe(
    'Ainda não montei o guia de Days Gone. Tenta de novo em 1 minuto.',
  )
  spyOn(guide, 'guideSummary').mockReturnValue('resumo')
  spyOn(watcher, 'getChat').mockReturnValue(makeContext({ guide: {} as Guide }))
  expect(await handleCommand(user, '/guide')).toBe('Days Gone\nresumo')
})

test('plan checks the minutes and tells a linked chat it is working', async () => {
  const ctx = makeContext()
  spyOn(watcher, 'getChat').mockReturnValue(ctx)
  const plan = spyOn(planner, 'planSession').mockResolvedValue({} as never)
  spyOn(planner, 'planReport').mockReturnValue('o plano')
  expect(await handleCommand(user, '/plan 5')).toBe('Uso: /plan <minutos entre 15 e 600>')
  expect(await handleCommand(user, '/plan')).toBe('o plano')
  expect(plan).toHaveBeenCalledWith(user, ctx, 120)
  expect(send).not.toHaveBeenCalled()
  await handleCommand(linked, '/plan 60')
  expect(plan).toHaveBeenLastCalledWith(linked, ctx, 60)
  expect(send).toHaveBeenCalledWith('42', 'Montando o plano…')
})

test('next lists the closest platinums, skipping the current game', async () => {
  spyOn(watcher, 'getChat').mockReturnValue(makeContext())
  const rank = spyOn(ranking, 'rankNextPlatinum').mockResolvedValue([
    { game: makeGame({ name: 'Ghost' }), baseProgress: 90, remaining: 3 },
  ] as never)
  const out = await handleCommand(user, '/next')
  expect(out).toContain('1. Ghost: 90%, faltam 3 troféus')
  expect(rank).toHaveBeenCalledWith(titles, user, 8, ['NPWR1'])
  rank.mockResolvedValue([])
  spyOn(watcher, 'getChat').mockReturnValue(undefined)
  expect(await handleCommand(user, '/next')).toBe('Não achei jogo em andamento com platina.')
  expect(rank).toHaveBeenLastCalledWith(titles, user, 8, [])
})

test('game switches the conversation to a title found by part of its name', async () => {
  const set = spyOn(watcher, 'setChat').mockResolvedValue(
    makeContext({ title: titles[1], guide: {} as Guide }),
  )
  expect(await handleCommand(user, '/game')).toBe('Uso: /game <parte do nome>')
  expect(await handleCommand(user, '/game zelda')).toBe('Não achei "zelda" no seu perfil.')
  expect(await handleCommand(linked, '/game ghost')).toBe(
    'Agora falando de Ghost of Tsushima (50%). Guia pronto: manda /guide.',
  )
  expect(set).toHaveBeenCalledWith(linked, titles[1])
  expect(send).toHaveBeenCalledWith('42', 'Carregando Ghost of Tsushima…')
  set.mockResolvedValue(makeContext())
  expect(await handleCommand(user, '/game days')).toBe('Agora falando de Days Gone (50%).')
})

test('goals shows the year, or runs the subcommand', async () => {
  spyOn(interests, 'yearProgress').mockResolvedValue({} as never)
  spyOn(interests, 'yearReport').mockReturnValue('o ano')
  const cmd = spyOn(interests, 'handleInterestCommand').mockResolvedValue('feito')
  expect(await handleCommand(user, '/goals')).toBe('o ano')
  expect(await handleCommand(user, '/goals set 12')).toBe('feito')
  expect(cmd).toHaveBeenCalledWith(user, 'set 12', titles)
})

test('pick answers with the chosen interest, or how to save one', async () => {
  const pick = {
    id: 'recommendation:1',
    game: { id: 'game:2', name: 'Inside' },
    why: 'Curto',
    firstStep: 'Comece',
    mood: null,
    scope: 'interests' as const,
    ownedOnly: false,
    fits: true,
    recommender: 'nexo' as const,
    at: '2026-10-18T10:00:00Z',
  }
  const ask = spyOn(nextPickModule, 'nextPick').mockResolvedValueOnce(pick)
  expect(await handleCommand(linked, '/pick')).toBe(
    '🎯 Sua próxima platina: Inside\nCurto\n\nPor onde começar: Comece',
  )
  expect(ask.mock.calls[0][3]).toEqual({ mood: undefined })
  // What follows the command is the mood; nothing on the list fitting it says so.
  ask.mockResolvedValueOnce({ ...pick, mood: 'algo curto', fits: false })
  expect(await handleCommand(linked, '/pick algo curto')).toEndWith(
    'No app, em Descobrir, dá para procurar fora da lista.',
  )
  expect(ask.mock.calls[1][3]).toEqual({ mood: 'algo curto' })
  ask.mockResolvedValueOnce(null)
  expect(await handleCommand(linked, '/pick')).toStartWith('Salve jogos nos seus interesses')
})

test('recommend searches, and refresh forces a new list', async () => {
  const recs = spyOn(recommend, 'recommendations').mockResolvedValue({} as never)
  spyOn(recommend, 'recommendationReport').mockReturnValue('jogos')
  expect(await handleCommand(linked, '/recommend refresh')).toBe('jogos')
  expect(recs).toHaveBeenCalledWith(linked, titles, [], true)
  expect(send).toHaveBeenCalledWith('42', 'Pesquisando…')
})

test('servers reports on the library', async () => {
  const report = spyOn(servers, 'serverReport').mockResolvedValue('servidores')
  expect(await handleCommand(user, '/servers')).toBe('servidores')
  expect(report).toHaveBeenCalledWith(user, titles)
})
