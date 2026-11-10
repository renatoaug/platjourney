import { afterEach, expect, spyOn, test } from 'bun:test'
import type { PlacedGuide } from '../../../shared/journey/places.ts'
import * as ai from '../src/ai.ts'
import * as db from '../src/db.ts'
import { keepUnlocks, withPlayerSteps } from '../src/player-steps.ts'
import type { TrophyStatus } from '../src/psn.ts'

const trophy = (id: number, name: string, extra: Partial<TrophyStatus> = {}) =>
  ({ id, name, earned: false, type: 'bronze', groupId: 'default', ...extra }) as TrophyStatus

const trophies = [trophy(1, 'Capítulo 2'), trophy(2, 'Capítulo 5'), trophy(3, 'Arma no nível 30')]
const guide: PlacedGuide = {
  storyline: { unit: 'chapter', total: 8 },
  trophyPlaces: [
    { trophy: 'Capítulo 2', from: 2 },
    { trophy: 'Capítulo 5', from: 5 },
    { trophy: 'Arma no nível 30', from: 3 },
  ],
  trophyKinds: [{ trophy: 'Arma no nível 30', kind: 'grind' }],
}

afterEach(() => {
  ;(db.q as unknown as { mockRestore?: () => void }).mockRestore?.()
  ;(ai.ai as unknown as { mockRestore?: () => void }).mockRestore?.()
})

test("a player's earned trophies are kept once, with their PSN times", async () => {
  const q = spyOn(db, 'q').mockResolvedValue([])
  const list = [
    trophy(1, 'Capítulo 2', { earned: true, earnedAt: '2026-01-02T10:00:00Z' }),
    trophies[1],
  ]
  keepUnlocks('u1', 'NPWR1', list)
  keepUnlocks('u1', 'NPWR1', list)
  await Promise.resolve()
  expect(q).toHaveBeenCalledTimes(1)
  const rows = (q.mock.calls[0][1] as { rows: { trophy_id: number }[] }).rows
  expect(rows.map((r) => r.trophy_id)).toEqual([1])
})

test('a guide gets where players usually closed its long trophies', async () => {
  // Three players earned the upgrade after the chapter 5 trophy, one after chapter 2 only.
  const row = (user: string, id: number, at: string) => ({ user, trophy_id: id, earned_at: at })
  spyOn(db, 'q').mockResolvedValue([
    ...['a', 'b', 'c'].flatMap((u) => [
      row(u, 1, '2026-01-01T00:00:00Z'),
      row(u, 2, '2026-01-05T00:00:00Z'),
      row(u, 3, '2026-01-06T00:00:00Z'),
    ]),
    row('d', 1, '2026-01-01T00:00:00Z'),
    row('d', 3, '2026-01-02T00:00:00Z'),
  ])
  const out = await withPlayerSteps(guide, trophies, 'NPWR-steps')
  expect(out?.trophySteps).toEqual([{ trophy: 'Arma no nível 30', step: 5, players: 4 }])
})

test('without places, trophies or a list, the guide is left as it is', async () => {
  const q = spyOn(db, 'q').mockResolvedValue([])
  expect(await withPlayerSteps({}, trophies, 'NPWR1')).toEqual({})
  expect(await withPlayerSteps(guide, [], 'NPWR1')).toBe(guide)
  expect(await withPlayerSteps(guide, trophies, null)).toBe(guide)
  expect(q).not.toHaveBeenCalled()
})

test("a guide without the model's estimate asks for it once, in the background", async () => {
  spyOn(db, 'q').mockResolvedValue([])
  const call = spyOn(ai, 'ai').mockResolvedValue([])
  const game = { id: 'game:steps', name: 'Jogo' } as Parameters<typeof withPlayerSteps>[3]
  await withPlayerSteps(guide, trophies, 'NPWR-predict', game)
  await withPlayerSteps(guide, trophies, 'NPWR-predict', game)
  expect(call).toHaveBeenCalledTimes(1)
  expect(call.mock.calls[0][0]).toBe('/guides/predict-steps')
  // A guide that has it, or places nothing, asks for nothing.
  const other = { ...game, id: 'game:steps-2' } as typeof game
  await withPlayerSteps({ ...guide, predictedSteps: [] }, trophies, 'NPWR-predict', other)
  await withPlayerSteps({}, trophies, 'NPWR-predict', other)
  expect(call).toHaveBeenCalledTimes(1)
})
