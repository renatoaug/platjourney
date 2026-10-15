import './env.ts'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { handleInterestCommand, yearProgress, yearReport } from '../src/interests.ts'
import * as ranking from '../src/ranking.ts'
import * as games from '../src/repository/game.ts'
import * as repo from '../src/repository/interest.ts'
import * as prices from '../src/repository/store-price.ts'
import * as users from '../src/repository/user.ts'
import { counts, makeGame, makeGroups, makeTitle, makeUser } from './fixtures.ts'

const year = new Date().getFullYear()
const user = makeUser()
const alpha = makeGame({ id: 'game:10', name: 'Alpha', np_communication_ids: ['NPA4', 'NPA5'] })
const beta = makeGame({ id: 'game:11', name: 'Beta', np_communication_ids: ['NPB'] })
const gamma = makeGame({ id: 'game:12', name: 'Gamma', np_communication_ids: ['NPG'] })
const interest = (id: string, game = alpha, position = 1) => ({
  id: `interest:${id}`,
  game,
  year,
  position,
})

beforeEach(() => {
  spyOn(prices, 'pricesFor').mockResolvedValue(new Map())
})

afterEach(() => mock.restore())

test('interests take the best copy of their game and base-game progress', async () => {
  spyOn(users, 'getUser').mockResolvedValue(makeUser({ goal_targets: { [String(year)]: 12 } }))
  spyOn(repo, 'listInterests').mockResolvedValue([
    { ...interest('a', alpha, 1), recommended_at: '2026-10-01T12:00:00Z' },
    interest('b', beta, 2),
    interest('c', gamma, 3),
  ])
  const groups = spyOn(ranking, 'loadGroups').mockResolvedValue(makeGroups())
  const library = [
    makeTitle({ npCommunicationId: 'NPA4', progress: 10 }),
    makeTitle({ npCommunicationId: 'NPA5', progress: 60 }),
    makeTitle({
      npCommunicationId: 'NPB',
      progress: 100,
      earned: 0,
      earnedByType: counts(0, 0, 0, 1),
      lastUpdated: `${year}-03-01T00:00:00Z`,
    }),
  ]
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map([['NPB', beta]]))
  const played = new Map([['game:10', { seconds: 5400 }]])
  const p = await yearProgress(user, library, year, played)
  expect(groups).toHaveBeenCalledTimes(1)
  expect(groups.mock.calls[0][0].npCommunicationId).toBe('NPA5')
  expect(p.target).toBe(12)
  expect(p.interests).toEqual([
    {
      id: 'interest:a',
      game: alpha,
      position: 1,
      progress: 50,
      hours: 1.5,
      recommendedAt: '2026-10-01T12:00:00Z',
      nextPickAt: null,
      source: null,
      savedAt: null,
      deal: null,
      done: false,
    },
    {
      id: 'interest:b',
      game: beta,
      position: 2,
      progress: 100,
      hours: null,
      recommendedAt: null,
      nextPickAt: null,
      source: null,
      savedAt: null,
      deal: null,
      done: true,
    },
    {
      id: 'interest:c',
      game: gamma,
      position: 3,
      progress: null,
      hours: null,
      recommendedAt: null,
      nextPickAt: null,
      source: null,
      savedAt: null,
      deal: null,
      done: false,
    },
  ])
  expect(p.platinumed).toEqual([{ game: beta, at: `${year}-03-01`, hours: null }])
  expect(p.done).toBe(1)
})

test('with DLC counted, PSN progress is used as it is', async () => {
  spyOn(users, 'getUser').mockResolvedValue(undefined)
  spyOn(repo, 'listInterests').mockResolvedValue([interest('a')])
  const groups = spyOn(ranking, 'loadGroups')
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  const p = await yearProgress(makeUser({ include_dlc_progress: true }), [
    makeTitle({ npCommunicationId: 'NPA4', progress: 70 }),
  ])
  expect(groups).not.toHaveBeenCalled()
  expect(p.target).toBeNull()
  expect(p.interests[0].progress).toBe(70)
})

test('a game on sale is a deal until the player says they already have it', async () => {
  spyOn(users, 'getUser').mockResolvedValue(undefined)
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  spyOn(repo, 'listInterests').mockResolvedValue([
    interest('a'),
    { ...interest('b', beta, 2), owned_at: '2026-10-15T12:00:00Z' },
  ])
  const sale = {
    price: 4498,
    base: 29990,
    discount: 85,
    endsAt: null,
    plus: false,
    currency: 'BRL',
  }
  spyOn(prices, 'pricesFor').mockResolvedValue(
    new Map([
      ['game:10', sale],
      ['game:11', sale],
    ]) as never,
  )
  const p = await yearProgress(user, [])
  expect(p.interests.map((i) => i.deal?.discount ?? null)).toEqual([85, null])
})

test('platinums of the year are listed by date', async () => {
  spyOn(users, 'getUser').mockResolvedValue(makeUser())
  spyOn(repo, 'listInterests').mockResolvedValue([])
  const plat = (np: string, date: string) =>
    makeTitle({ npCommunicationId: np, earnedByType: counts(1, 0, 0, 1), lastUpdated: date })
  spyOn(games, 'gamesForTitles').mockResolvedValue(
    new Map([
      ['NPL', beta],
      ['NPE', gamma],
    ]),
  )
  const p = await yearProgress(user, [
    plat('NPL', `${year}-09-01T00:00:00Z`),
    plat('NPE', `${year}-02-01T00:00:00Z`),
    plat('NPOLD', '2001-01-01T00:00:00Z'),
  ])
  expect(p.platinumed.map((x) => x.game.name)).toEqual(['Gamma', 'Beta'])
})

test('the report shows the goal, the interests and the platinums', () => {
  expect(
    yearReport({
      year: 2026,
      target: 10,
      done: 2,
      platinumed: [{ game: beta, at: '2026-03-01', hours: null }],
      interests: [
        {
          id: 'i1',
          game: alpha,
          position: 1,
          progress: 40,
          done: false,
          hours: null,
          recommendedAt: null,
          nextPickAt: null,
          source: null,
          savedAt: null,
          deal: null,
        },
        {
          id: 'i2',
          game: beta,
          position: 2,
          progress: 100,
          done: true,
          hours: null,
          recommendedAt: null,
          nextPickAt: null,
          source: null,
          savedAt: null,
          deal: null,
        },
        {
          id: 'i3',
          game: gamma,
          position: 3,
          progress: null,
          done: false,
          hours: null,
          recommendedAt: null,
          nextPickAt: null,
          source: null,
          savedAt: null,
          deal: null,
        },
      ],
    }),
  ).toBe(
    [
      'Meta 2026: 2/10 platinas (20%)',
      '',
      'Interesses:',
      '1. Alpha — 40%',
      '2. Beta — ✅',
      '3. Gamma — não começou',
      '',
      'Platinadas no ano:',
      '• 2026-03-01 Beta',
    ].join('\n'),
  )
})

test('a report without a goal suggests setting one', () => {
  expect(yearReport({ year: 2026, target: null, done: 0, platinumed: [], interests: [] })).toBe(
    '2026: 0 platinas até agora (sem meta definida — /goals set 12)',
  )
})

describe('/goals', () => {
  let update: ReturnType<typeof spyOn<typeof users, 'updateUser'>>
  let order: ReturnType<typeof spyOn<typeof repo, 'setInterestOrder'>>

  beforeEach(() => {
    spyOn(users, 'getUser').mockResolvedValue(makeUser({ goal_targets: { '2000': 3 } }))
    update = spyOn(users, 'updateUser').mockResolvedValue(undefined)
    order = spyOn(repo, 'setInterestOrder').mockResolvedValue(undefined)
    spyOn(repo, 'listInterests').mockResolvedValue([
      interest('a', alpha, 1),
      interest('b', beta, 2),
      interest('c', gamma, 3),
    ])
    spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
    spyOn(ranking, 'loadGroups').mockResolvedValue(null)
  })

  test('set stores the goal for this year', async () => {
    expect(await handleInterestCommand(user, 'set 12', [])).toContain('Interesses:')
    expect(update).toHaveBeenCalledWith('user:u1', {
      goal_targets: { '2000': 3, [String(year)]: 12 },
    })
    expect(await handleInterestCommand(user, 'set zero', [])).toBe(
      'Uso: /goals set <número de platinas>',
    )
  })

  test('add takes a game id or a name', async () => {
    const add = spyOn(repo, 'addInterest').mockResolvedValue(undefined)
    spyOn(games, 'getGame').mockResolvedValue(alpha)
    spyOn(games, 'gameByName').mockImplementation((async (name: string) =>
      name === 'Beta' ? beta : undefined) as never)
    await handleInterestCommand(user, 'add game:10', [])
    await handleInterestCommand(user, 'add Beta', [])
    expect(add.mock.calls).toEqual([
      ['user:u1', 'game:10', year],
      ['user:u1', 'game:11', year],
    ])
    expect(await handleInterestCommand(user, 'add Nada', [])).toBe('Não achei "Nada".')
    expect(await handleInterestCommand(user, 'add', [])).toBe('Uso: /goals add <nome do jogo>')
  })

  test('remove takes a list number or an interest id', async () => {
    const remove = spyOn(repo, 'removeInterest').mockResolvedValue(undefined)
    await handleInterestCommand(user, 'remove 2', [])
    await handleInterestCommand(user, 'remove interest:c', [])
    expect(remove.mock.calls).toEqual([
      ['user:u1', 'interest:b'],
      ['user:u1', 'interest:c'],
    ])
    expect(await handleInterestCommand(user, 'remove 9', [])).toBe(
      'Uso: /goals remove <número da lista>',
    )
    expect(await handleInterestCommand(user, 'remove x', [])).toBe(
      'Uso: /goals remove <número da lista>',
    )
  })

  test('owned takes a list number or an interest id', async () => {
    const owned = spyOn(repo, 'markOwned').mockResolvedValue(undefined)
    await handleInterestCommand(user, 'owned 2', [])
    await handleInterestCommand(user, 'owned interest:c', [])
    expect(owned.mock.calls).toEqual([
      ['user:u1', 'interest:b'],
      ['user:u1', 'interest:c'],
    ])
    expect(await handleInterestCommand(user, 'owned', [])).toBe(
      'Uso: /goals owned <número da lista>',
    )
  })

  test('move swaps with the neighbour and ignores the edges', async () => {
    await handleInterestCommand(user, 'move 2 up', [])
    await handleInterestCommand(user, 'move interest:a down', [])
    await handleInterestCommand(user, 'move 1 up', [])
    expect(order.mock.calls).toEqual([
      ['user:u1', year, ['interest:b', 'interest:a', 'interest:c']],
      ['user:u1', year, ['interest:b', 'interest:a', 'interest:c']],
    ])
    expect(await handleInterestCommand(user, 'move 1 sideways', [])).toBe(
      'Uso: /goals move <número> up|down',
    )
  })

  test('order takes a full list of interest ids', async () => {
    await handleInterestCommand(user, 'order interest:c, interest:a', [])
    expect(order).toHaveBeenCalledWith('user:u1', year, ['interest:c', 'interest:a'])
    expect(await handleInterestCommand(user, 'order 1,2', [])).toBe(
      'Uso: /goals order <ids separados por vírgula>',
    )
  })

  test('anything else just shows the report', async () => {
    expect(await handleInterestCommand(user, '', [])).toContain('platinas')
    expect(update).not.toHaveBeenCalled()
  })
})

test('a game saved from the web keeps where it came from; an unknown source is dropped', async () => {
  const add = spyOn(repo, 'addInterest').mockResolvedValue()
  spyOn(games, 'getGame').mockResolvedValue(makeGame({ id: 'game:12', name: 'Phantom Blade Zero' }))
  spyOn(repo, 'listInterests').mockResolvedValue([])
  spyOn(users, 'getUser').mockResolvedValue(makeUser())
  spyOn(games, 'gamesForTitles').mockResolvedValue(new Map())
  const user = makeUser()
  await handleInterestCommand(user, 'add game:12 from:releases', [])
  expect(add).toHaveBeenLastCalledWith(user.id, 'game:12', expect.any(Number), 'releases')
  await handleInterestCommand(user, 'add game:12 from:nowhere', [])
  expect(add).toHaveBeenLastCalledWith(user.id, 'game:12', expect.any(Number), undefined)
})
