import './env.ts'
import { expect, test } from 'bun:test'
import { config } from '../src/config.ts'

test('optional settings fall back to their defaults', () => {
  expect(config.ai.url).toBeString()
  expect(config.auth.verificationMinutes).toBe(30)
})

test('a missing secret stops the app from loading', async () => {
  const saved = process.env.IGDB_CLIENT_SECRET
  delete process.env.IGDB_CLIENT_SECRET
  const path = '../src/config.js?missing-secret'
  try {
    await expect(import(path)).rejects.toThrow('Missing env var IGDB_CLIENT_SECRET')
  } finally {
    process.env.IGDB_CLIENT_SECRET = saved
  }
})

test('every setting reads its environment variable', async () => {
  const env = {
    AI_RESEARCH: '0',
    COOKIE_SECURE: '1',
  }
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]))
  Object.assign(process.env, env)
  const path = '../src/config.js?all-set'
  try {
    const { config: loaded } = await import(path)
    expect(loaded.automatic.research).toBe(false)
    expect(loaded.auth.secureCookie).toBe(true)
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})
