import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage } from 'node:http'
import { clientIp, hashIp, noteAccess, startAccessCleanup } from '../src/access.ts'
import { config } from '../src/config.ts'
import * as accesses from '../src/repository/access.ts'
import { makeUser } from './api-fixtures.ts'

const saved = { ...config.access }
let record: ReturnType<typeof spyOn>

const request = (address: string, forwarded?: string, cf?: string) =>
  ({
    headers: {
      ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
      ...(cf ? { 'cf-connecting-ip': cf } : {}),
    },
    socket: { remoteAddress: address },
  }) as unknown as IncomingMessage

beforeEach(() => {
  config.access.secret = 'secret'
  config.access.trustProxy = false
  record = spyOn(accesses, 'recordAccess').mockResolvedValue()
})

afterEach(() => {
  Object.assign(config.access, saved)
  mock.restore()
})

test('the address comes from the socket unless a proxy is trusted', () => {
  const req = request('::ffff:10.0.0.1', '198.51.100.7, 203.0.113.9')
  expect(clientIp(req)).toBe('10.0.0.1')
  config.access.trustProxy = true
  // The first hop is whatever the client sent; the last one is what the proxy saw.
  expect(clientIp(req)).toBe('203.0.113.9')
  expect(clientIp(request('10.0.0.1', '198.51.100.7, 203.0.113.9', '203.0.113.50'))).toBe(
    '203.0.113.50',
  )
  expect(clientIp(request('10.0.0.2'))).toBe('10.0.0.2')
})

test('the hash is stable, keyed and does not hold the address', () => {
  const a = hashIp('203.0.113.9', 'k1')
  expect(a).toBe(hashIp('203.0.113.9', 'k1'))
  expect(a).not.toBe(hashIp('203.0.113.9', 'k2'))
  expect(a).not.toContain('203')
  expect(a).toMatch(/^[a-f0-9]{64}$/)
})

test('an access is written once an hour per account and address', async () => {
  const user = makeUser({ id: 'user:once' })
  await noteAccess(request('198.51.100.1'), user)
  await noteAccess(request('198.51.100.1'), user)
  await noteAccess(request('198.51.100.2'), user)
  expect(record).toHaveBeenCalledTimes(2)
  expect(record.mock.calls[0]).toEqual(['user:once', hashIp('198.51.100.1', 'secret')])
})

test('nothing is written without the secret or for the demo player', async () => {
  await noteAccess(request('198.51.100.3'), makeUser({ id: 'user:demo', demo: true }))
  config.access.secret = null
  await noteAccess(request('198.51.100.3'), makeUser({ id: 'user:nosecret' }))
  expect(record).not.toHaveBeenCalled()
})

test('old accesses are cleaned at start, only with the secret', () => {
  const clean = spyOn(accesses, 'deleteAccessesBefore').mockResolvedValue()
  const timer = spyOn(globalThis, 'setInterval').mockReturnValue({ unref() {} } as never)
  startAccessCleanup()
  expect(clean).toHaveBeenCalledWith(saved.keepDays)
  expect(timer).toHaveBeenCalledTimes(1)
  config.access.secret = null
  startAccessCleanup()
  expect(clean).toHaveBeenCalledTimes(1)
})
