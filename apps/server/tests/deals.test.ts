import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { checkDeals, newSale } from '../src/deals.ts'
import * as psstore from '../src/psstore.ts'
import * as activity from '../src/repository/activity.ts'
import * as prices from '../src/repository/store-price.ts'
import * as users from '../src/repository/user.ts'
import * as telegram from '../src/telegram.ts'
import { makeUser } from './fixtures.ts'

afterEach(() => mock.restore())

const p = (price: number, base = 10000, discount = 0) => ({
  base,
  price,
  discount,
  endsAt: null,
  plus: false,
  plusPrice: null,
  plusTier: null,
  currency: 'BRL',
})

test('a sale is worth telling from full price, or when it gets deeper', () => {
  expect(newSale(undefined, p(5000, 10000, 50))).toBe(true)
  expect(newSale(p(10000), p(5000, 10000, 50))).toBe(true)
  expect(newSale(p(5000, 10000, 50), p(5000, 10000, 50))).toBe(false)
  expect(newSale(p(5000, 10000, 50), p(3000, 10000, 70))).toBe(true)
  expect(newSale(undefined, p(10000))).toBe(false)
})

test('every saved game is read and kept, and a new sale reaches who saved it', async () => {
  spyOn(prices, 'interestsWithStore').mockResolvedValue([
    {
      game: 'game:1',
      name: 'Days Gone',
      store_url: 'https://store.playstation.com/concept/1',
      users: ['user:a'],
    },
    {
      game: 'game:2',
      name: 'Inside',
      store_url: 'https://store.playstation.com/concept/2',
      users: ['user:a'],
    },
  ])
  spyOn(prices, 'pricesFor').mockResolvedValue(new Map())
  const save = spyOn(prices, 'savePrice').mockResolvedValue()
  spyOn(psstore, 'storePrice').mockImplementation(async (url: string) =>
    url.endsWith('/1') ? { ...p(7485, 24950, 70), endsAt: '2026-10-20T00:00:00.000Z' } : p(10000),
  )
  spyOn(users, 'getUser').mockResolvedValue(makeUser({ id: 'user:a', telegram_chat_id: '42' }))
  const tip = spyOn(activity, 'logTip').mockResolvedValue()
  const send = spyOn(telegram, 'sendMessage').mockResolvedValue()
  expect(await checkDeals(0)).toBe(1)
  expect(save).toHaveBeenCalledTimes(2)
  expect(tip).toHaveBeenCalledTimes(1)
  const [, kind, text, game] = tip.mock.calls[0]
  expect([kind, game]).toEqual(['deal', 'game:1'])
  expect(text).toContain('**Days Gone** está com 70% de desconto')
  expect(text).toContain('74,85 até 20 de outubro. Está nos seus interesses.')
  expect(send).toHaveBeenCalledWith('42', text)
})

test('a saved game joining the PS Plus catalog reaches only who has that tier', async () => {
  spyOn(prices, 'interestsWithStore').mockResolvedValue([
    {
      game: 'game:3',
      name: 'Echoes of the End',
      store_url: 'u3',
      users: ['user:extra', 'user:essential'],
    },
  ])
  spyOn(prices, 'pricesFor').mockResolvedValue(new Map())
  spyOn(prices, 'savePrice').mockResolvedValue()
  spyOn(psstore, 'storePrice').mockResolvedValue({ ...p(22990), plus: true, plusTier: 'extra' })
  spyOn(users, 'getUser').mockImplementation(async (id: string) =>
    makeUser({ id, ps_plus: id === 'user:extra' ? 'extra' : 'essential', telegram_chat_id: null }),
  )
  const tip = spyOn(activity, 'logTip').mockResolvedValue()
  await checkDeals(0)
  expect(tip).toHaveBeenCalledTimes(1)
  expect(tip.mock.calls[0][0]).toBe('user:extra')
  expect(tip.mock.calls[0][2]).toContain('entrou no catálogo do seu PS Plus Extra')
})

test('several deals for one player arrive as one notice listing them', async () => {
  spyOn(prices, 'interestsWithStore').mockResolvedValue([
    { game: 'game:1', name: 'Days Gone', store_url: 'u1', users: ['user:a'] },
    { game: 'game:2', name: 'Inside', store_url: 'u2', users: ['user:a'] },
  ])
  spyOn(prices, 'pricesFor').mockResolvedValue(new Map())
  spyOn(prices, 'savePrice').mockResolvedValue()
  spyOn(psstore, 'storePrice').mockImplementation(async (url: string) =>
    url === 'u1' ? p(7485, 24950, 70) : p(4995, 9990, 50),
  )
  spyOn(users, 'getUser').mockResolvedValue(makeUser({ id: 'user:a', telegram_chat_id: '42' }))
  const tip = spyOn(activity, 'logTip').mockResolvedValue()
  const send = spyOn(telegram, 'sendMessage').mockResolvedValue()
  expect(await checkDeals(0)).toBe(2)
  expect(tip).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledTimes(1)
  const text = tip.mock.calls[0][2]
  expect(text).toContain('2 jogos dos seus interesses estão mais baratos na PS Store:')
  expect(text).toContain('• **Days Gone**: 70% off')
  expect(text).toContain('• **Inside**: 50% off')
})

test('the demo player never gets a deal notice', async () => {
  spyOn(prices, 'interestsWithStore').mockResolvedValue([
    { game: 'game:1', name: 'Days Gone', store_url: 'u1', users: ['user:demo'] },
  ])
  spyOn(prices, 'pricesFor').mockResolvedValue(new Map())
  spyOn(prices, 'savePrice').mockResolvedValue()
  spyOn(psstore, 'storePrice').mockResolvedValue(p(7485, 24950, 70))
  spyOn(users, 'getUser').mockResolvedValue(makeUser({ id: 'user:demo', demo: true }))
  const tip = spyOn(activity, 'logTip').mockResolvedValue()
  await checkDeals(0)
  expect(tip).not.toHaveBeenCalled()
})
