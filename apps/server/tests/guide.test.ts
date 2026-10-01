import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import * as aiModule from '../src/ai.ts'
import { currentTag } from '../src/costs.ts'
import { ensureGuide, GUIDE_VERSION, type Guide, guideSummary } from '../src/guide.ts'
import * as guides from '../src/repository/guide.ts'
import { makeGame, makeTrophy } from './fixtures.ts'

const guide = (over: Partial<Guide> = {}): Guide => ({
  version: GUIDE_VERSION,
  difficulty: 4,
  hours: 30,
  playthroughs: 1,
  hasMissables: false,
  hasOnline: false,
  overview: 'Tranquilo.',
  glossary: [],
  missables: [],
  roadmap: [{ phase: 'Fase 1', goal: 'Zerar', trophies: [] }],
  earlyTips: [],
  onlineTrophies: [],
  easiest: null,
  hardest: null,
  mostTedious: null,
  tricks: [],
  buggy: [],
  collectibles: null,
  pointOfNoReturn: null,
  autopop: null,
  sources: [],
  ...over,
})

afterEach(() => mock.restore())

test('a current stored guide is used as it is', async () => {
  const stored = guide()
  spyOn(guides, 'getGuide').mockResolvedValue(stored)
  const ai = spyOn(aiModule, 'ai')
  expect(await ensureGuide(makeGame())).toBe(stored)
  expect(ai).not.toHaveBeenCalled()
})

test('a missing or outdated guide is researched, versioned and saved', async () => {
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(guides, 'getGuide').mockResolvedValue(guide({ version: 1 }))
  const save = spyOn(guides, 'saveGuide').mockResolvedValue(undefined)
  let tag: unknown
  const ai = spyOn(aiModule, 'ai').mockImplementation((async () => {
    tag = currentTag()
    return guide({ version: undefined })
  }) as never)
  const game = makeGame()
  const trophies = [makeTrophy()]
  const built = await ensureGuide(game, trophies, { name: 'Days Gone', platform: 'PS4' })
  expect(ai).toHaveBeenCalledWith('/guides/research', {
    game,
    trophies,
    edition: { name: 'Days Gone', platform: 'PS4' },
  })
  expect(tag).toEqual({ action: 'guide' })
  expect(built.version).toBe(GUIDE_VERSION)
  expect(save).toHaveBeenCalledWith('game:1', built)
})

test('a game without trophies is researched by name', async () => {
  spyOn(console, 'log').mockImplementation(() => {})
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  spyOn(guides, 'saveGuide').mockResolvedValue(undefined)
  const ai = spyOn(aiModule, 'ai').mockResolvedValue(guide())
  await ensureGuide(makeGame())
  expect(ai.mock.calls[0][1]).toEqual({ game: makeGame(), trophies: null, edition: null })
})

test('the summary lists only the sections the guide has', () => {
  expect(guideSummary(guide())).toBe(
    'Dificuldade 4/10 · ~30h · 1 run · sem missables\nTranquilo.\n\nRoadmap:\nFase 1: Zerar',
  )
})

test('a full summary shows missables, online, key trophies, tricks and sources', () => {
  const text = guideSummary(
    guide({
      playthroughs: 2,
      hasMissables: true,
      hasOnline: true,
      missables: [{ trophy: 'Carta', when: 'Cap. 1', how: 'Leia' }],
      onlineTrophies: [
        { trophy: 'Rei', what: 'Vença 10', boostable: true },
        { trophy: 'Time', what: 'Jogue 5', boostable: false },
      ],
      easiest: { trophy: 'Fácil', why: 'história' },
      hardest: { trophy: 'Difícil', why: 'chefe' },
      mostTedious: { trophy: 'Chato', why: 'grind' },
      tricks: [{ trophy: 'Ouro', trick: 'pule', source: 'PSNP' }],
      sources: ['a.com', 'b.com'],
    }),
  )
  expect(text).toBe(
    [
      'Dificuldade 4/10 · ~30h · 2 runs · TEM missables · tem online',
      'Tranquilo.',
      '',
      'Missables:',
      '• Carta — Cap. 1: Leia',
      '',
      'Online:',
      '• Rei — Vença 10 (dá pra boostar)',
      '• Time — Jogue 5',
      '',
      'Mais fácil: Fácil — história',
      'Mais difícil: Difícil — chefe',
      'Mais chato: Chato — grind',
      '',
      'Macetes:',
      '• Ouro: pule (PSNP)',
      '',
      'Roadmap:',
      'Fase 1: Zerar',
      '',
      'Fontes: a.com, b.com',
    ].join('\n'),
  )
})
