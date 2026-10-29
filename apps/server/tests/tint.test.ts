import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as db from '../src/db.ts'
import { tintOf, tints } from '../src/tint.ts'

afterEach(() => mock.restore())

// A buffer of RGBA pixels, all one color.
const pixels = (r: number, g: number, b: number, n = 64) =>
  new Uint8Array(Array.from({ length: n }, () => [r, g, b, 255]).flat())

test('the tint is the picture’s strongest hue, as a light color', () => {
  const red = tintOf(pixels(200, 30, 30))
  const blue = tintOf(pixels(30, 60, 200))
  expect(red).toMatch(/^#[0-9a-f]{6}$/)
  // Red stays red, blue stays blue.
  expect(Number.parseInt(red.slice(1, 3), 16)).toBeGreaterThan(Number.parseInt(red.slice(5, 7), 16))
  expect(Number.parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(
    Number.parseInt(blue.slice(1, 3), 16),
  )
})

test('a grey picture keeps the brand’s own hue', () => {
  expect(tintOf(pixels(120, 120, 120))).toBe(tintOf(new Uint8Array()))
})

test('stored tints come back by game; one read from the same picture is not read again', async () => {
  spyOn(db, 'q').mockResolvedValue([
    { game: 'game:1', color: '#cdae7a', picture: 'https://images.igdb.com/a/t_1080p/x.jpg' },
  ] as never)
  const fetch = spyOn(globalThis, 'fetch')
  const found = await tints([
    {
      id: 'game:1',
      name: 'One',
      art_url: 'https://images.igdb.com/a/t_1080p/x.jpg',
      cover_url: null,
    },
  ])
  expect(found.get('game:1')).toBe('#cdae7a')
  expect(fetch).not.toHaveBeenCalled()
})

test('a failed read sends no tint and reads nothing new', async () => {
  spyOn(db, 'q').mockRejectedValue(new Error('down'))
  const fetch = spyOn(globalThis, 'fetch')
  const found = await tints([{ id: 'game:1', name: 'One', art_url: 'x.jpg', cover_url: null }])
  expect(found.size).toBe(0)
  expect(fetch).not.toHaveBeenCalled()
})
