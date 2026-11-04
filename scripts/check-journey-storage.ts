// Uses the same disposable loopback SurrealDB service as check-push-migration.ts. No account data.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateJourney } from '../shared/journey/model.ts'
import { selectJourneySession } from '../shared/journey/session.ts'
import { parseJourneyModel } from '../shared/journey/validation.ts'

Object.assign(process.env, {
  PSN_NPSSO: 'test',
  TELEGRAM_BOT_TOKEN: 'test',
  AI_TOKEN: 'test',
  IGDB_CLIENT_ID: 'test',
  IGDB_CLIENT_SECRET: 'test',
  SURREAL_URL: 'http://127.0.0.1:18183/rpc',
  SURREAL_USER: 'test',
  SURREAL_PASS: 'local-test-only',
  SURREAL_NS: 'journey_storage_test',
  SURREAL_DB: `test_${Date.now()}`,
})
const { migrate, q, closeDb } = await import('../apps/server/src/db.ts')
const { importJourneyModel, getJourneyModel, publishJourneyModel, journeyChecksum } = await import(
  '../apps/server/src/repository/journey-model.ts'
)
try {
  await migrate()
  await q(
    "CREATE game:1 SET igdb_id = 1, slug = 'synthetic-one', name = 'Synthetic catalogue one', np_communication_ids = ['NPWR22997_00']; CREATE game:2 SET igdb_id = 2, slug = 'synthetic-two', name = 'Synthetic catalogue two', np_communication_ids = ['NPWR13822_00']; CREATE user:preserved SET psn_online_id = 'synthetic', psn_online_id_lower = 'synthetic', psn_account_id = 'synthetic';",
  )
  const preserved = await q('SELECT * FROM user:preserved')
  for (const [game, file] of [
    ['game:1', 'npwr22997_00-v2.json'],
    ['game:2', 'npwr13822_00-v2.json'],
  ]) {
    const model = parseJourneyModel(
      JSON.parse(readFileSync(new URL(`../db/journeys/${file}`, import.meta.url), 'utf8')),
    )
    assert.equal(await getJourneyModel(game, model.edition), undefined)
    await assert.rejects(importJourneyModel('game:999', model))
    await importJourneyModel(game, model)
    await importJourneyModel(game, model)
    assert.equal(await getJourneyModel(game, model.edition), undefined, 'staging does not publish')
    await assert.rejects(importJourneyModel(game, { ...model, name: 'Changed' }))
    await publishJourneyModel(game, model.edition, model.version, null)
    assert.deepEqual(await getJourneyModel(game, model.edition), model)
    assert.equal(await getJourneyModel('game:999', model.edition), undefined)
    assert.equal(await getJourneyModel(game, 'UNKNOWN'), undefined)
    const next = { ...model, version: model.version + 1, name: `${model.name} revision` }
    await importJourneyModel(game, next)
    await publishJourneyModel(game, model.edition, next.version, model.version)
    await assert.rejects(publishJourneyModel(game, model.edition, model.version, model.version))
    assert.equal((await getJourneyModel(game, model.edition))?.version, next.version)
    await publishJourneyModel(game, model.edition, model.version, next.version)
    const restored = await getJourneyModel(game, model.edition)
    assert.ok(restored)
    assert.equal(journeyChecksum(restored), journeyChecksum(model))
    for (const earned of [
      [],
      [model.objectives[0].key],
      [model.objectives.find((o) => o.kind === 'story' && o.order > 60)?.key],
    ]) {
      const trophies = model.objectives.map((o) => ({
        id: o.trophyId,
        groupId: o.groupId,
        name: o.names[0],
        type: o.kind === 'platinum' ? 'platinum' : 'bronze',
        earned: earned.includes(o.key),
      }))
      const before = structuredClone(trophies)
      assert.deepEqual(evaluateJourney(restored, trophies), evaluateJourney(model, trophies))
      assert.deepEqual(
        selectJourneySession(restored, trophies, 120, false, []),
        selectJourneySession(model, trophies, 120, false, []),
      )
      assert.deepEqual(trophies, before)
    }
    await publishJourneyModel(game, model.edition, null, model.version)
    assert.equal(await getJourneyModel(game, model.edition), undefined)
    await publishJourneyModel(game, model.edition, model.version, null)
    console.log(
      `${model.edition}: stage/read/immutable version/CAS/rollback/fallback/progress/session passed`,
    )
  }
  const records = await q('SELECT * FROM journey_model ORDER BY id')
  await migrate()
  assert.deepEqual(await q('SELECT * FROM journey_model ORDER BY id'), records)
  assert.deepEqual(await q('SELECT * FROM user:preserved'), preserved)
  console.log('Schema replay preserves model versions and existing account data')
} finally {
  await closeDb()
}
