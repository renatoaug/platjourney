import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { config } from '../src/config.ts'
import { currentTag } from '../src/costs.ts'
import { deepGuideStats, ensureDeepGuide, indexDeepGuide } from '../src/deepguide.ts'
import { makeGame } from './fixtures.ts'

const stats = { chunks: 3, sources: [], indexing: false, indexedAt: null }
const research = config.automatic.research

afterEach(() => {
  config.automatic.research = research
  mock.restore()
})

test('indexing waits for the job and sends the known pages', async () => {
  let tag: unknown
  const ai = spyOn(aiModule, 'ai').mockImplementation((async () => {
    tag = currentTag()
    return stats
  }) as never)
  const pages = [{ url: 'https://x.com/guide', site: 'x.com' }]
  expect(await indexDeepGuide(makeGame(), 40, pages)).toEqual(stats)
  expect(ai).toHaveBeenCalledWith('/deep-guide/index', {
    game: makeGame(),
    trophyTotal: 40,
    pages,
    wait: true,
  })
  expect(tag).toEqual({ action: 'guide_index' })
})

test('indexing without pages lets the service search for them', async () => {
  const ai = spyOn(aiModule, 'ai').mockResolvedValue(stats)
  await indexDeepGuide(makeGame())
  expect(ai.mock.calls[0][1]).toMatchObject({ trophyTotal: null, pages: null })
})

test('with automatic research the index is ensured', async () => {
  config.automatic.research = true
  const ai = spyOn(aiModule, 'ai').mockResolvedValue(stats)
  expect(await ensureDeepGuide(makeGame(), 40)).toEqual(stats)
  expect(ai).toHaveBeenCalledWith('/deep-guide/ensure', { game: makeGame(), trophyTotal: 40 })
  await ensureDeepGuide(makeGame())
  expect(ai.mock.calls[1][1]).toEqual({ game: makeGame(), trophyTotal: null })
})

test('without automatic research only the stats are read', async () => {
  config.automatic.research = false
  const ai = spyOn(aiModule, 'ai').mockResolvedValue(stats)
  expect(await ensureDeepGuide(makeGame(), 40)).toEqual(stats)
  expect(ai).toHaveBeenCalledWith('/deep-guide/stats', { game: makeGame() })
})

test('stats read as null when the service fails', async () => {
  spyOn(console, 'error').mockImplementation(() => {})
  spyOn(aiModule, 'ai').mockRejectedValue(new Error('down'))
  expect(await deepGuideStats(makeGame())).toBeNull()
})
