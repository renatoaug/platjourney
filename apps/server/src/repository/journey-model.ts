import { createHash } from 'node:crypto'
import type { JourneyModel } from '../../../../shared/journey/model.ts'
import { parseJourneyModel } from '../../../../shared/journey/validation.ts'
import { camelKeys, gameId, one, q, rid, snakeKeys } from '../db.ts'

// Canonical keys make the checksum independent of JSON formatting and object key order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    )
  return value
}
export const journeyChecksum = (model: JourneyModel) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(model)))
    .digest('hex')
const key = (game: string, edition: string) =>
  createHash('sha256')
    .update(`${String(gameId(game))}/${edition}`)
    .digest('hex')
const versionRef = (game: string, edition: string, version: number) =>
  rid('journey_model', `${key(game, edition)}_${version}`)
const publicationRef = (game: string, edition: string) =>
  rid('journey_publication', key(game, edition))

interface StoredModel {
  game: unknown
  payload: unknown
  checksum: string
  edition: string
  version: number
}
function decode(row: StoredModel, game: string, edition: string): JourneyModel {
  const model = parseJourneyModel(camelKeys(row.payload))
  if (
    String(row.game) !== String(gameId(game)) ||
    model.edition !== edition ||
    model.edition !== row.edition ||
    model.version !== row.version ||
    journeyChecksum(model) !== row.checksum
  )
    throw new Error('Journey model integrity check failed')
  return model
}

/** A missing publication uses the ordinary guide. Corruption/unavailable storage fails explicitly. */
export async function getJourneyModel(
  game: string,
  edition?: string,
): Promise<JourneyModel | undefined> {
  if (!edition) return undefined
  const row = await one<{ model: StoredModel | null }>(
    'SELECT model FROM journey_publication WHERE game = $game AND edition = $edition LIMIT 1 FETCH model',
    { game: gameId(game), edition },
  )
  return row?.model ? decode(row.model, game, edition) : undefined
}

/** Import is idempotent. A published or draft version can never be replaced with different data. */
export async function importJourneyModel(game: string, input: unknown): Promise<JourneyModel> {
  const model = parseJourneyModel(input)
  const checksum = journeyChecksum(model)
  await q(
    `BEGIN TRANSACTION;
    LET $catalog = SELECT VALUE np_communication_ids FROM $game;
    IF !($catalog[0] CONTAINS $edition) { THROW 'Journey edition does not belong to this catalog game'; };
    LET $existing = SELECT * FROM $id;
    IF array::len($existing) > 0 {
      IF $existing[0].checksum != $checksum { THROW 'Journey version already exists with different content'; };
    } ELSE {
      CREATE $id CONTENT { game: $game, edition: $edition, version: $version, checksum: $checksum, payload: $payload };
    };
    COMMIT TRANSACTION;`,
    {
      id: versionRef(game, model.edition, model.version),
      game: gameId(game),
      edition: model.edition,
      version: model.version,
      checksum,
      payload: snakeKeys(model),
    },
  )
  return model
}

/** Explicit compare-and-set activation also supports rollback and deactivation; no versions deleted. */
export async function publishJourneyModel(
  game: string,
  edition: string,
  version: number | null,
  expected: number | null,
): Promise<void> {
  const target =
    version === null
      ? undefined
      : await one<StoredModel>('SELECT * FROM $id', { id: versionRef(game, edition, version) })
  if (version !== null && !target)
    throw new Error('Import the journey version before publishing it')
  if (target) decode(target, game, edition)
  await q(
    `BEGIN TRANSACTION;
    LET $catalog = SELECT VALUE np_communication_ids FROM $game;
    IF !($catalog[0] CONTAINS $edition) { THROW 'Journey edition does not belong to this catalog game'; };
    LET $current = SELECT * FROM $id;
    IF ($current[0].version ?? NULL) != $expected { THROW 'Journey publication changed; read it again before publishing'; };
    UPSERT $id SET game = $game, edition = $edition, model = $model, version = $version;
    COMMIT TRANSACTION;`,
    {
      id: publicationRef(game, edition),
      game: gameId(game),
      edition,
      expected,
      model: version === null ? null : versionRef(game, edition, version),
      version,
    },
  )
}
