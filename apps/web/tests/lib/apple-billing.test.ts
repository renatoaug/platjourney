import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import {
  appleProducts,
  isAppleBilling,
  manageAppleSubscriptions,
  purchaseApple,
  restoreApplePurchases,
  watchAppleTransactions,
} from '../../src/lib/apple-billing'

const token = '21e18820-cbe3-420f-8fc0-91dd7d7db319'
const checkoutToken = 'de0bdf31-f2db-4f56-bf08-f210843a2c51'
const transaction = {
  transactionId: '42',
  productId: 'credits',
  signedTransactionInfo: 'signed.jws',
}
const purchase = mock(async () => ({ status: 'purchased', transaction }))
const finish = mock(async () => {})
const products = mock(async () => ({
  products: [{ productId: 'credits', displayPrice: 'R$ 9,90' }],
}))
const unfinished = mock(async () => ({ transactions: [] as (typeof transaction)[] }))
const restore = mock(async () => ({ transactions: [transaction] }))
const manage = mock(async () => {})
const remove = mock(async () => {})
let listener: (value: typeof transaction) => void
const addListener = mock(async (_event: string, callback: typeof listener) => {
  listener = callback
  return { remove }
})
const native = {
  isNativePlatform: () => true,
  getPlatform: () => 'ios',
  Plugins: {
    AppleBilling: {
      products,
      purchase,
      unfinished,
      restore,
      finish,
      manageSubscriptions: manage,
      addListener,
    },
  },
}
const windowWithBridge = window as Window & { Capacitor?: unknown }
let fetchSpy: ReturnType<typeof spyOn>
const requests: string[] = []
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  windowWithBridge.Capacitor = native
  for (const fn of [purchase, finish, products, unfinished, restore, manage, remove, addListener])
    fn.mockClear()
  purchase.mockImplementation(async () => ({ status: 'purchased', transaction }))
  unfinished.mockImplementation(async () => ({ transactions: [] }))
  restore.mockImplementation(async () => ({ transactions: [transaction] }))
  finish.mockImplementation(async () => {})
  requests.length = 0
  fetchSpy = spyOn(globalThis, 'fetch')
  fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input)
    requests.push(url)
    return Response.json(
      url.endsWith('/prepare')
        ? { productId: 'credits', appAccountToken: token }
        : { accepted: true },
    )
  })
})
afterEach(() => {
  fetchSpy.mockRestore()
  delete windowWithBridge.Capacitor
})

describe('Apple billing coordinator', () => {
  test('iOS platform never falls back when bridge is missing', async () => {
    windowWithBridge.Capacitor = { ...native, Plugins: {} }
    expect(isAppleBilling()).toBe(true)
    await expect(purchaseApple('credits')).rejects.toThrow('APPLE_BILLING_UNAVAILABLE')
    delete windowWithBridge.Capacitor
    expect(isAppleBilling()).toBe(false)
    windowWithBridge.Capacitor = { ...native, getPlatform: () => 'android' }
    expect(isAppleBilling()).toBe(false)
  })
  test('loads Apple localized prices and manages subscriptions natively', async () => {
    expect((await appleProducts(['credits']))[0]?.displayPrice).toBe('R$ 9,90')
    expect(products).toHaveBeenCalledWith({ productIds: ['credits'] })
    expect(await appleProducts([])).toEqual([])
    await manageAppleSubscriptions()
    expect(manage).toHaveBeenCalledTimes(1)
  })
  test('server preparation precedes purchase and durable acceptance precedes finish', async () => {
    purchase.mockImplementation(async () => {
      expect(requests).toEqual(['/api/ext/billing/apple/prepare'])
      expect(finish).not.toHaveBeenCalled()
      return { status: 'purchased', transaction }
    })
    expect(await purchaseApple('credits')).toBe('purchased')
    expect(purchase).toHaveBeenCalledWith({ productId: 'credits', appAccountToken: token })
    expect(requests).toEqual(['/api/ext/billing/apple/prepare', '/api/ext/billing/apple/verify'])
    expect(finish).toHaveBeenCalledWith({ transactionId: '42' })
    expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({
      signedTransactionInfo: 'signed.jws',
    })
  })
  test('Stripe conflict prevents opening StoreKit', async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ error: 'stripe_active' }, { status: 409 }),
    )
    await expect(purchaseApple('credits')).rejects.toThrow()
    expect(purchase).not.toHaveBeenCalled()
  })
  test('mismatched prepared product and invalid token fail closed', async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ productId: 'other', appAccountToken: token }),
    )
    await expect(purchaseApple('credits')).rejects.toThrow('APPLE_PURCHASE_NOT_PREPARED')
    fetchSpy.mockImplementation(async () =>
      Response.json({ productId: 'credits', appAccountToken: 'bad' }),
    )
    await expect(purchaseApple('credits')).rejects.toThrow('APPLE_PURCHASE_NOT_PREPARED')
    expect(purchase).not.toHaveBeenCalled()
  })
  test.each(['pending', 'cancelled'])('%s does not verify or finish', async (status) => {
    purchase.mockImplementation(async () => ({ status, transaction }))
    expect(await purchaseApple('credits')).toBe(status)
    expect(requests).toEqual(['/api/ext/billing/apple/prepare'])
    expect(finish).not.toHaveBeenCalled()
  })
  test('subscription cancellation releases only the prepared checkout lease', async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ productId: 'credits', appAccountToken: token, checkoutToken }),
    )
    purchase.mockImplementation(async () => ({ status: 'cancelled', transaction }))
    expect(await purchaseApple('credits')).toBe('cancelled')
    expect(fetchSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      '/api/ext/billing/apple/prepare',
      '/api/ext/billing/apple/cancel',
    ])
    expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toEqual({ checkoutToken })
    expect(purchase).toHaveBeenCalledWith({ productId: 'credits', appAccountToken: token })
    expect(finish).not.toHaveBeenCalled()
  })
  test.each(['pending', 'purchased'])(
    'subscription %s keeps its checkout lease',
    async (status) => {
      fetchSpy.mockImplementation(async (url: RequestInfo | URL) =>
        Response.json(
          String(url).endsWith('/prepare')
            ? { productId: 'credits', appAccountToken: token, checkoutToken }
            : { accepted: true },
        ),
      )
      purchase.mockImplementation(async () => ({ status, transaction }))
      expect(await purchaseApple('credits')).toBe(status)
      expect(fetchSpy.mock.calls.map((call: unknown[]) => call[0])).toEqual(
        status === 'pending'
          ? ['/api/ext/billing/apple/prepare']
          : ['/api/ext/billing/apple/prepare', '/api/ext/billing/apple/verify'],
      )
    },
  )
  test.each(['', 'invalid', null, 123])(
    'invalid checkout token %s prevents StoreKit purchase',
    async (invalidToken) => {
      fetchSpy.mockImplementation(async () =>
        Response.json({
          productId: 'credits',
          appAccountToken: token,
          checkoutToken: invalidToken,
        }),
      )
      await expect(purchaseApple('credits')).rejects.toThrow('APPLE_PURCHASE_NOT_PREPARED')
      expect(purchase).not.toHaveBeenCalled()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    },
  )
  test('uncertain subscription purchase failure does not release its checkout lease', async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ productId: 'credits', appAccountToken: token, checkoutToken }),
    )
    purchase.mockImplementation(async () => {
      throw new Error('interrupted')
    })
    await expect(purchaseApple('credits')).rejects.toThrow('interrupted')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(finish).not.toHaveBeenCalled()
  })
  test('backend rejection or network failure leaves transaction unfinished', async () => {
    fetchSpy.mockImplementation(async (url: RequestInfo | URL) =>
      Response.json(
        String(url).endsWith('/prepare')
          ? { productId: 'credits', appAccountToken: token }
          : { accepted: false },
      ),
    )
    await expect(purchaseApple('credits')).rejects.toThrow('APPLE_TRANSACTION_NOT_ACCEPTED')
    expect(finish).not.toHaveBeenCalled()
    fetchSpy.mockImplementation(async () => {
      throw new Error('offline')
    })
    await expect(restoreApplePurchases()).rejects.toThrow('offline')
    expect(finish).not.toHaveBeenCalled()
  })
  test('explicit restore verifies and finishes delivered transactions', async () => {
    await restoreApplePurchases()
    expect(restore).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledWith({ transactionId: '42' })
  })
  test('listener precedes unfinished replay and duplicate delivery is deduplicated', async () => {
    unfinished.mockImplementation(async () => {
      listener(transaction)
      return { transactions: [transaction] }
    })
    const accepted = mock(() => {})
    const failed = mock(() => {})
    const stop = await watchAppleTransactions(accepted, failed)
    await flush()
    expect(requests).toEqual(['/api/ext/billing/apple/verify'])
    expect(finish).toHaveBeenCalledTimes(1)
    expect(failed).not.toHaveBeenCalled()
    stop()
    listener(transaction)
    await flush()
    expect(requests).toHaveLength(1)
    expect(remove).toHaveBeenCalledTimes(1)
  })
  test('failed replay retries when connectivity returns without finishing early', async () => {
    unfinished.mockImplementation(async () => ({ transactions: [transaction] }))
    fetchSpy.mockImplementation(async () => {
      throw new Error('offline')
    })
    const failed = mock(() => {})
    const stop = await watchAppleTransactions(() => {}, failed)
    await flush()
    expect(failed).toHaveBeenCalledTimes(1)
    expect(finish).not.toHaveBeenCalled()
    fetchSpy.mockImplementation(async () => Response.json({ accepted: true }))
    window.dispatchEvent(new Event('online'))
    await flush()
    expect(finish).toHaveBeenCalledTimes(1)
    stop()
    window.dispatchEvent(new Event('online'))
    await flush()
    expect(unfinished).toHaveBeenCalledTimes(2)
  })
  test('StoreKit errors do not verify, finish or release an uncertain purchase', async () => {
    purchase.mockImplementation(async () => {
      throw new Error('store unavailable')
    })
    await expect(purchaseApple('credits')).rejects.toThrow('store unavailable')
    expect(requests).toEqual(['/api/ext/billing/apple/prepare'])
    expect(finish).not.toHaveBeenCalled()
  })
  test('restore processes valid transactions even when another belongs to a different account', async () => {
    restore.mockImplementation(async () => ({
      transactions: [
        transaction,
        { ...transaction, transactionId: '43', signedTransactionInfo: 'valid.jws' },
      ],
    }))
    fetchSpy.mockImplementation(async (_url: RequestInfo | URL, options: RequestInit) =>
      Response.json({
        accepted: JSON.parse(String(options.body)).signedTransactionInfo === 'valid.jws',
      }),
    )
    await expect(restoreApplePurchases()).rejects.toThrow('APPLE_TRANSACTION_NOT_ACCEPTED')
    expect(finish).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledWith({ transactionId: '43' })
  })
  test('finish failure remains retryable after the server has accepted', async () => {
    finish.mockImplementationOnce(async () => {
      throw new Error('bridge interrupted')
    })
    await expect(restoreApplePurchases()).rejects.toThrow('bridge interrupted')
    await restoreApplePurchases()
    expect(finish).toHaveBeenCalledTimes(2)
  })
})
