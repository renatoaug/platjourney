import { describe, expect, test } from 'bun:test'
import { screenOf } from '../../src/app/navigation'

describe('screenOf', () => {
  test('a path alone is its screen', () => {
    expect(screenOf({ pathname: '/settings', search: '' })).toBe('/settings')
  })

  test("a game's page is a screen of its own", () => {
    expect(screenOf({ pathname: '/game', search: '?view=journey' })).toBe('/game?view=journey')
  })

  test('other parameters do not make a new screen', () => {
    expect(screenOf({ pathname: '/games', search: '?tab=interests' })).toBe('/games')
  })
})
