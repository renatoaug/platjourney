import { expect, test } from 'bun:test'
import { parseJourneyModel } from '../../../shared/journey/validation.ts'
import { odyssey, requiem } from './journey-fixtures.ts'

test('both import documents validate without changing their source-linked content', () => {
  for (const model of [requiem, odyssey]) {
    const before = structuredClone(model)
    expect(parseJourneyModel(model)).toBe(model)
    expect(model).toEqual(before)
  }
})
type MutableDocument = Record<string, unknown> & {
  objectives: (Record<string, unknown> & {
    action: Record<string, unknown>
    placement: Record<string, unknown>
  })[]
}
const bad: [string, (v: MutableDocument) => void][] = [
  [
    'unknown schema',
    (v) => {
      v.schemaVersion = 2
    },
  ],
  [
    'unknown field',
    (v) => {
      v.location = 'invented'
    },
  ],
  [
    'bad edition',
    (v) => {
      v.edition = 'game:1'
    },
  ],
  [
    'missing name',
    (v) => {
      v.name = ''
    },
  ],
  [
    'fractional version',
    (v) => {
      v.version = 1.1
    },
  ],
  [
    'invalid date',
    (v) => {
      v.reviewedAt = '2026-02-30'
    },
  ],
  [
    'no objectives',
    (v) => {
      v.objectives = []
    },
  ],
  [
    'duplicate key',
    (v) => {
      v.objectives[1].key = v.objectives[0].key
    },
  ],
  [
    'duplicate id',
    (v) => {
      v.objectives[1].trophyId = v.objectives[0].trophyId
    },
  ],
  [
    'unsupported group',
    (v) => {
      v.objectives[0].groupId = '001'
    },
  ],
  [
    'missing action',
    (v) => {
      delete v.objectives[0].action.en
    },
  ],
  [
    'unsafe source',
    (v) => {
      v.objectives[0].sources = ['javascript:alert(1)']
    },
  ],
  [
    'invalid source',
    (v) => {
      v.objectives[0].sources = ['not a url']
    },
  ],
  [
    'duplicate sources',
    (v) => {
      v.objectives[0].sources = ['https://example.org', 'https://example.org']
    },
  ],
  [
    'empty sources',
    (v) => {
      v.objectives[0].placement.sources = []
    },
  ],
  [
    'bad name tuple',
    (v) => {
      v.objectives[0].names = ['Only one']
    },
  ],
  [
    'bad key',
    (v) => {
      v.objectives[0].key = 'invalid key'
    },
  ],
  [
    'unknown kind',
    (v) => {
      v.objectives[0].kind = 'location'
    },
  ],
  [
    'missing relation',
    (v) => {
      v.objectives[0].requires = ['missing']
    },
  ],
  [
    'dependency cycle',
    (v) => {
      v.objectives[0].requires = [v.objectives[1].key]
      v.objectives[1].requires = [v.objectives[0].key]
    },
  ],
  [
    'self evidence',
    (v) => {
      v.objectives[0].evidenceAny = [v.objectives[0].key]
    },
  ],
  [
    'missing evidence',
    (v) => {
      v.objectives[0].evidenceAny = ['missing']
    },
  ],
  [
    'invalid chapter',
    (v) => {
      v.objectives[0].chapter = 100
    },
  ],
  [
    'invalid ongoing',
    (v) => {
      v.objectives[0].ongoing = 'yes'
    },
  ],
  [
    'invalid risk',
    (v) => {
      v.objectives[0].risk = 'imagined'
    },
  ],
  [
    'invalid planning',
    (v) => {
      v.planning = { kind: 'chapters', finalChapter: 17, finale: 'chapter-17' }
    },
  ],
  [
    'open world unknown finale',
    (v) => {
      v.planning = { kind: 'open-world', finale: 'missing' }
    },
  ],
  [
    'open world chapter field',
    (v) => {
      v.planning = { kind: 'open-world', finale: 'chapter-17', finalChapter: 17 }
    },
  ],
]
for (const [label, change] of bad)
  test(`reject ${label}`, () => {
    const input = structuredClone(requiem)
    change(input as unknown as MutableDocument)
    expect(() => parseJourneyModel(input)).toThrow('Invalid journey model')
  })
test('null, arrays and oversized documents are not model objects', () => {
  for (const input of [
    null,
    [],
    {},
    { ...requiem, objectives: Array(1001).fill(requiem.objectives[0]) },
  ])
    expect(() => parseJourneyModel(input)).toThrow()
})
