import type { JourneyModel } from './model'

type ObjectValue = Record<string, unknown>
const fail = (path: string): never => {
  throw new Error(`Invalid journey model: ${path}`)
}
function object(value: unknown, path: string, fields: string[]): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path)
  const result = value as ObjectValue
  if (Object.keys(result).some((key) => !fields.includes(key))) fail(`${path}.unknown-field`)
  return result
}
function string(value: unknown, path: string, max = 8000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(path)
}
function integer(value: unknown, path: string, min = 0, max = 10000) {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(path)
}
function choice(value: unknown, path: string, choices: string[]) {
  if (!choices.includes(value as string)) fail(path)
}
function texts(value: unknown, path: string) {
  const v = object(value, path, ['pt', 'en'])
  string(v.pt, `${path}.pt`)
  string(v.en, `${path}.en`)
}
function strings(value: unknown, path: string, min = 0): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > 1000) return fail(path)
  value.forEach((x, i) => {
    string(x, `${path}.${i}`, 2048)
  })
  if (new Set(value).size !== value.length) fail(`${path}.duplicate`)
  return value
}
function sources(value: unknown, path: string) {
  for (const source of strings(value, path, 1)) {
    let url: URL
    try {
      url = new URL(source)
    } catch {
      return fail(path)
    }
    if (url.protocol !== 'https:' || url.username || url.password) fail(path)
  }
}
const objectiveFields = [
  'key',
  'trophyId',
  'groupId',
  'placement',
  'names',
  'kind',
  'order',
  'chapter',
  'requires',
  'prepareFrom',
  'completionChapter',
  'ongoing',
  'evidenceAny',
  'availability',
  'risk',
  'action',
  'approach',
  'recovery',
  'sources',
]
function objective(value: unknown, index: number) {
  const path = `objectives.${index}`
  const o = object(value, path, objectiveFields)
  string(o.key, `${path}.key`, 100)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.key)) fail(`${path}.key`)
  integer(o.trophyId, `${path}.trophyId`)
  // Schema v1 covers the base list; DLC requires separately reviewed schema support.
  if (o.groupId !== 'default') fail(`${path}.groupId`)
  if (!Array.isArray(o.names) || o.names.length !== 2) fail(`${path}.names`)
  for (const name of o.names as unknown[]) string(name, `${path}.names`, 500)
  choice(o.kind, `${path}.kind`, [
    'story',
    'chapter',
    'collectible',
    'upgrade',
    'skill',
    'counter',
    'quest',
    'task',
    'platinum',
  ])
  integer(o.order, `${path}.order`)
  optionalObjective(o, path)
  texts(o.action, `${path}.action`)
  sources(o.sources, `${path}.sources`)
  placement(o.placement, `${path}.placement`)
}
function optionalObjective(o: ObjectValue, path: string) {
  for (const field of ['chapter', 'prepareFrom', 'completionChapter'])
    if (o[field] !== undefined) integer(o[field], `${path}.${field}`, 1, 1000)
  for (const field of ['requires', 'evidenceAny'])
    if (o[field] !== undefined) strings(o[field], `${path}.${field}`)
  if (o.ongoing !== undefined && typeof o.ongoing !== 'boolean') fail(`${path}.ongoing`)
  if (o.risk !== undefined)
    choice(o.risk, `${path}.risk`, ['replay', 'skill-carryover', 'opportunity'])
  for (const field of ['availability', 'approach', 'recovery'])
    if (o[field] !== undefined) texts(o[field], `${path}.${field}`)
}
function placement(value: unknown, path: string) {
  const p = object(value, path, ['kind', 'after', 'before', 'label', 'evidence', 'sources'])
  choice(p.kind, `${path}.kind`, ['story', 'window', 'parallel', 'destination'])
  for (const field of ['after', 'before'])
    if (p[field] !== undefined) string(p[field], `${path}.${field}`, 100)
  texts(p.label, `${path}.label`)
  texts(p.evidence, `${path}.evidence`)
  sources(p.sources, `${path}.sources`)
}

/** Validate imports and database reads before evaluating stored knowledge. */
export function parseJourneyModel(value: unknown): JourneyModel {
  const v = object(value, 'root', [
    'schemaVersion',
    'edition',
    'name',
    'version',
    'reviewedAt',
    'objectives',
    'planning',
  ])
  if (v.schemaVersion !== 1) fail('schemaVersion')
  string(v.edition, 'edition', 32)
  if (!/^NPWR\d{5}_\d{2}$/.test(v.edition)) fail('edition')
  string(v.name, 'name', 500)
  integer(v.version, 'version', 1)
  reviewedDate(v.reviewedAt)
  if (!Array.isArray(v.objectives) || !v.objectives.length || v.objectives.length > 1000)
    fail('objectives')
  const entries = v.objectives as unknown[]
  entries.forEach(objective)
  validatePlanning(v.planning)
  const model = value as JourneyModel
  validateRelations(model)
  return model
}

function validateRelations(model: JourneyModel) {
  const keys = new Map(model.objectives.map((o) => [o.key, o]))
  const identities = new Set(model.objectives.map((o) => `${o.groupId}:${o.trophyId}`))
  if (keys.size !== model.objectives.length || identities.size !== model.objectives.length)
    fail('duplicate-identity')
  if (model.planning.kind === 'open-world' && keys.get(model.planning.finale)?.kind !== 'story')
    fail('planning.finale')
  const edges = new Map<string, Set<string>>()
  const add = (from: string, to: string) => {
    if (!keys.has(from) || !keys.has(to) || from === to) fail('relations.reference')
    if (!edges.has(from)) edges.set(from, new Set())
    edges.get(from)?.add(to)
  }
  for (const o of model.objectives) addRelations(o, model, keys, add)
  checkCycles(keys, edges)
}
function addRelations(
  o: JourneyModel['objectives'][number],
  model: JourneyModel,
  keys: Map<string, JourneyModel['objectives'][number]>,
  add: (from: string, to: string) => void,
) {
  for (const ref of o.requires ?? []) add(ref, o.key)
  for (const ref of o.evidenceAny ?? []) if (!keys.has(ref)) fail('evidenceAny.reference')
  if (o.evidenceAny?.includes(o.key)) fail('evidenceAny.self')
  if (o.placement.after) add(o.placement.after, o.key)
  if (o.placement.before) add(o.key, o.placement.before)
  chapterRange(o, model)
}
function chapterRange(o: JourneyModel['objectives'][number], model: JourneyModel) {
  if (model.planning.kind === 'chapters') {
    for (const n of [o.chapter, o.prepareFrom, o.completionChapter])
      if (n !== undefined && n > model.planning.finalChapter) fail('chapter.range')
  }
}
function checkCycles(keys: Map<string, unknown>, edges: Map<string, Set<string>>) {
  const visited = new Set<string>()
  const active = new Set<string>()
  const visit = (key: string) => {
    if (active.has(key)) fail('relations.cycle')
    if (visited.has(key)) return
    active.add(key)
    for (const next of edges.get(key) ?? []) visit(next)
    active.delete(key)
    visited.add(key)
  }
  for (const key of keys.keys()) visit(key)
}

function reviewedDate(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail('reviewedAt')
}

function validatePlanning(value: unknown) {
  const planning = object(value, 'planning', ['kind', 'finalChapter', 'finale'])
  choice(planning.kind, 'planning.kind', ['chapters', 'open-world'])
  if (planning.kind === 'chapters') {
    integer(planning.finalChapter, 'planning.finalChapter', 1, 1000)
    if (planning.finale !== undefined) fail('planning.finale')
  } else {
    string(planning.finale, 'planning.finale', 100)
    if (planning.finalChapter !== undefined) fail('planning.finalChapter')
  }
}
