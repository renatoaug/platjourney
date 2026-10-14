import './env.ts'
import { expect, test } from 'bun:test'
import { brazilianPage, parseStorePage } from '../src/psstore.ts'

const price = (fields: Record<string, unknown>) =>
  `"price":${JSON.stringify({ __typename: 'Price', ...fields, telemetryData: { a: [] } })}}`

test('a store link from any region turns into the Brazilian page', () => {
  expect(brazilianPage('https://store.playstation.com/en-us/concept/229018')).toBe(
    'https://store.playstation.com/pt-br/concept/229018',
  )
  expect(brazilianPage('https://store.playstation.com/product/UP9000-CUSA00')).toBe(
    'https://store.playstation.com/pt-br/product/UP9000-CUSA00',
  )
  expect(brazilianPage('https://example.com/game')).toBeNull()
})

test('the main edition is the first price sold outright, with its discount and end', () => {
  const html = [
    price({
      basePriceValue: 0,
      serviceBranding: ['PS_PLUS'],
      isFree: true,
      isTiedToSubscription: true,
      tierLabel: 'TIER_30',
    }),
    price({
      basePriceValue: 24950,
      discountedValue: 7485,
      displayDiscountText: '-70%',
      serviceBranding: ['NONE'],
      endTime: String(Date.UTC(2026, 9, 20)),
      currencyCode: 'BRL',
    }),
    price({ basePriceValue: 9900, discountedValue: 9900, serviceBranding: ['NONE'] }),
    price({ basePriceValue: 24950, discountedValue: 4990, serviceBranding: ['PS_PLUS'] }),
  ].join(',')
  expect(parseStorePage(html)).toEqual({
    base: 24950,
    price: 7485,
    discount: 70,
    endsAt: '2026-10-20T00:00:00.000Z',
    plus: true,
    plusPrice: 4990,
    plusTier: 'deluxe',
    currency: 'BRL',
  })
})

test('a page without prices reads as nothing', () => {
  expect(parseStorePage('<html>no prices</html>')).toBeNull()
})
