// Opt-in integration check against a disposable LOCAL SurrealDB 3.0.5 instance.
// docker run --rm -p 127.0.0.1:18183:8000 surrealdb/surrealdb:v3.0.5 start --user test --pass local-test-only memory
// bun scripts/check-push-migration.ts
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

Object.assign(process.env, {
  PSN_NPSSO: 'test',
  TELEGRAM_BOT_TOKEN: 'test',
  AI_TOKEN: 'test',
  IGDB_CLIENT_ID: 'test',
  IGDB_CLIENT_SECRET: 'test',
  SURREAL_URL: 'http://127.0.0.1:18183/rpc',
  SURREAL_USER: 'test',
  SURREAL_PASS: 'local-test-only',
  SURREAL_NS: 'push_migration_test',
  SURREAL_DB: `test_${Date.now()}`,
})
const { migrate, q, closeDb } = await import('../apps/server/src/db.ts')
const web = await import('../apps/server/src/repository/push-subscription.ts')
const apns = await import('../apps/server/src/repository/native-push.ts')
const { setTrophyVisibility } = await import('../apps/server/src/repository/user.ts')
const { createSession, deleteSession } = await import('../apps/server/src/repository/auth.ts')
const migrations = new URL('../db/migrations/', import.meta.url)
const one = 'user:one'
const two = 'user:two'
const browser = {
  endpoint: 'https://push.example/one',
  p256dh: 'legacy-key',
  auth: 'legacy-secret',
}
const device = {
  installation: 'a'.repeat(64),
  token: 'b'.repeat(64),
  environment: 'production' as const,
}
try {
  const version = await (await fetch('http://127.0.0.1:18183/version')).text()
  assert.match(version, /3\.0\.5/)
  console.log(`Database: ${version}`)
  // Start with the actual old schema, not a hand-written approximation.
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith('.surql') && f < '028')
    .sort())
    await q(readFileSync(new URL(file, migrations), 'utf8'))
  // The user table file supports a clean database. Simulate an existing installation
  // without the new optional field before applying the normal startup migration path.
  const cleanUserSchema = await q<{ fields: Record<string, string> }>('INFO FOR TABLE user')
  assert.ok(cleanUserSchema.fields.revealed_trophy_games)
  await q('REMOVE FIELD IF EXISTS revealed_trophy_games ON user')
  await q(
    "CREATE user:one SET psn_online_id = 'push-one', psn_online_id_lower = 'push-one', psn_account_id = 'one'; CREATE user:two SET psn_online_id = 'push-two', psn_online_id_lower = 'push-two', psn_account_id = 'two';",
  )
  await q(
    'CREATE push_subscription:legacy SET user = user:one, endpoint = $endpoint, p256dh = $p256dh, auth = $secret',
    { endpoint: browser.endpoint, p256dh: browser.p256dh, secret: browser.auth },
  )
  const legacyBefore = await q<Record<string, unknown>[]>('SELECT * FROM push_subscription:legacy')
  await migrate()
  await migrate()
  const beforePreference = await q<Record<string, unknown>[]>('SELECT * FROM user:one')
  assert.equal(beforePreference[0].revealed_trophy_games, undefined)
  assert.deepEqual(await setTrophyVisibility(one, 'game:101', true), ['game:101'])
  assert.deepEqual(await setTrophyVisibility(one, 'game:101', true), ['game:101'])
  await setTrophyVisibility(one, 'game:202', true)
  const preferencesBeforeReplay = await q('SELECT * FROM user ORDER BY id')
  await migrate()
  assert.deepEqual(await q('SELECT * FROM user ORDER BY id'), preferencesBeforeReplay)
  assert.deepEqual(await setTrophyVisibility(one, 'game:101', false), ['game:202'])
  const otherPreference = await q<Record<string, unknown>[]>('SELECT * FROM user:two')
  assert.equal(otherPreference[0].revealed_trophy_games, undefined)
  await assert.rejects(q('UPDATE user:one SET revealed_trophy_games = [123]'))
  assert.deepEqual(await web.pushSubscriptions(one), [browser])
  const legacyAfter = await q<Record<string, unknown>[]>('SELECT * FROM push_subscription:legacy')
  for (const field of ['id', 'user', 'endpoint', 'p256dh', 'auth', 'created_at'])
    assert.deepEqual(legacyAfter[0][field], legacyBefore[0][field])
  assert.equal(legacyAfter[0].transport, 'webpush')
  assert.equal(legacyAfter[0].session_hash, undefined)
  assert.equal(legacyAfter[0].installation, undefined)
  await createSession(one, 'session-one', 1)
  await createSession(two, 'session-two', 1)
  await web.savePushSubscription(one, { ...browser, endpoint: 'https://push.example/two' })
  await apns.saveNativeDevice(one, 'session-one', device)
  const other = { ...device, installation: 'c'.repeat(64), token: 'd'.repeat(64) }
  await apns.saveNativeDevice(one, 'session-one', other)
  assert.equal((await web.pushSubscriptions(one)).length, 2)
  assert.equal((await apns.nativeDevices(one)).length, 2)
  // Reapplying migration with a mixed table preserves both shapes.
  const mixed = await q('SELECT * FROM push_subscription ORDER BY id')
  await migrate()
  assert.deepEqual(await q('SELECT * FROM push_subscription ORDER BY id'), mixed)
  await assert.rejects(
    q(
      "CREATE push_subscription SET transport = 'apns', user = user:one, installation = $installation, token = $deviceToken, environment = 'production', session_hash = 'session-one'",
      { installation: 'e'.repeat(64), deviceToken: device.token },
    ),
  )
  await apns.saveNativeDevice(one, 'session-one', {
    ...device,
    installation: 'f'.repeat(64),
    environment: 'sandbox',
  })
  await assert.rejects(q("CREATE push_subscription SET transport = 'fcm', user = user:one"))
  await assert.rejects(
    q("CREATE push_subscription SET transport = 'webpush', user = user:one, token = $deviceToken", {
      deviceToken: device.token,
    }),
  )
  await assert.rejects(
    q(
      "CREATE push_subscription SET transport = 'apns', user = user:one, installation = $installation, token = $deviceToken, environment = 'production'",
      { installation: '9'.repeat(64), deviceToken: '8'.repeat(64) },
    ),
  )
  await assert.rejects(
    apns.saveNativeDevice(one, 'session-one', { ...other, environment: 'invalid' as 'production' }),
  )
  await assert.rejects(
    q(
      "CREATE push_subscription SET user = user:one, installation = $installation, token = $deviceToken, environment = 'production', session_hash = 'session-one'",
      { installation: '9'.repeat(64), deviceToken: '8'.repeat(64) },
    ),
  )
  // A reinstall can keep the same APNs token but gets a new installation secret.
  const reinstalled = { ...device, installation: '6'.repeat(64) }
  await apns.saveNativeDevice(two, 'session-two', reinstalled)
  assert.equal(await apns.nativeDeviceActive(one, device), false)
  assert.equal(await apns.nativeDeviceActive(two, reinstalled), true)
  await apns.expireNativeDevice(device)
  assert.equal(await apns.nativeDeviceActive(two, reinstalled), true)
  // A rejected transfer must roll back its preceding DELETE atomically.
  await assert.rejects(apns.saveNativeDevice(one, '', device))
  assert.equal(await apns.nativeDeviceActive(two, reinstalled), true)
  await apns.saveNativeDevice(one, 'session-one', device)
  assert.equal(await apns.nativeDeviceActive(one, device), true)
  await deleteSession('session-one')
  assert.equal(await apns.nativeDeviceActive(one, device), false)
  assert.equal((await apns.nativeDevices(one)).length, 0)
  assert.equal((await web.pushSubscriptions(one)).length, 2) // Preserve legacy Web Push policy.
  await apns.saveNativeDevice(two, 'session-two', device)
  await apns.deleteNativeDevice(one, device.installation)
  assert.equal((await apns.nativeDevices(two)).length, 1)
  const renewed = { ...device, token: '7'.repeat(64) }
  await apns.saveNativeDevice(two, 'session-two', renewed)
  await apns.expireNativeDevice(device)
  assert.equal((await apns.nativeDevices(two))[0].token, renewed.token)
  await web.savePushSubscription(two, browser)
  await web.deletePushSubscription(browser.endpoint, one)
  assert.deepEqual(await web.pushSubscriptions(two), [browser])
  await web.deletePushSubscriptions(two)
  assert.equal((await apns.nativeDevices(two)).length, 1)
  await apns.deleteNativeDevices(one)
  assert.equal((await web.pushSubscriptions(one)).length, 1)
  await q("UPDATE auth_session SET expires_at = time::now() - 1h WHERE token_hash = 'session-two'")
  assert.equal((await apns.nativeDevices(two)).length, 0)
  await q(
    "CREATE push_subscription:oldwriter SET user = user:one, endpoint = 'https://push.example/direct', p256dh = 'key', auth = 'secret'",
  )
  await q('DELETE push_subscription:oldwriter')
  // Legacy Web Push writes still work after the in-place upgrade.
  await q(
    'UPSERT push_subscription SET user = user:one, endpoint = $endpoint, p256dh = $p256dh, auth = $secret WHERE endpoint = $endpoint',
    { endpoint: browser.endpoint, p256dh: browser.p256dh, secret: browser.auth },
  )
  assert.equal((await web.pushSubscriptions(one)).length, 2)
  await migrate()
  assert.equal((await web.pushSubscriptions(one)).length, 2)
  console.log(
    'PASS: legacy upgrade, repeat/mixed migration, discriminated validation, unique indexes, rotation, account/session isolation, scoped deletes and legacy writes',
  )
} finally {
  await closeDb()
}
