import { expect, test } from 'bun:test'
import { currentTag, tagged } from '../src/costs.ts'

test('outside any work there is no tag', () => {
  expect(currentTag()).toEqual({})
})

test('nested work keeps the outer tag and adds its own', async () => {
  const seen = await tagged({ user: 'user:1' }, () =>
    tagged({ action: 'chat' }, async () => currentTag()),
  )
  expect(seen).toEqual({ user: 'user:1', action: 'chat' })
  expect(currentTag()).toEqual({})
})
