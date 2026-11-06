import { api } from './api'

export interface AppleProduct {
  productId: string
  displayName: string
  description: string
  displayPrice: string
  type: string
  subscriptionPeriod?: { value: number; unit: string }
}

interface AppleTransaction {
  transactionId: string
  productId: string
  signedTransactionInfo: string
}

type PurchaseResult =
  | { status: 'purchased'; transaction: AppleTransaction }
  | { status: 'pending' | 'cancelled' }

interface AppleBridge {
  products(options: { productIds: string[] }): Promise<{ products: AppleProduct[] }>
  purchase(options: { productId: string; appAccountToken: string }): Promise<PurchaseResult>
  unfinished(): Promise<{ transactions: AppleTransaction[] }>
  restore(): Promise<{ transactions: AppleTransaction[] }>
  finish(options: { transactionId: string }): Promise<void>
  manageSubscriptions(): Promise<void>
  addListener(
    event: 'transactionUpdated',
    callback: (transaction: AppleTransaction) => void,
  ): Promise<{ remove(): Promise<void> }>
}

const capacitor = () =>
  (
    window as Window & {
      Capacitor?: {
        isNativePlatform?(): boolean
        getPlatform?(): string
        Plugins?: { AppleBilling?: AppleBridge }
      }
    }
  ).Capacitor

/** Detect the platform, not plugin availability: old iOS builds must never fall back to Stripe. */
export function isAppleBilling(): boolean {
  return capacitor()?.isNativePlatform?.() === true && capacitor()?.getPlatform?.() === 'ios'
}

function bridge(): AppleBridge {
  const plugin = capacitor()?.Plugins?.AppleBilling
  if (!isAppleBilling() || !plugin) throw new Error('APPLE_BILLING_UNAVAILABLE')
  return plugin
}

export async function appleProducts(productIds: string[]): Promise<AppleProduct[]> {
  if (productIds.length === 0) return []
  return (await bridge().products({ productIds })).products
}

// Concurrent purchase/update/replay delivery is normal. The backend also deduplicates durably.
const accepting = new Map<string, Promise<void>>()
function accept(transaction: AppleTransaction): Promise<void> {
  const key = transaction.signedTransactionInfo
  const pending = accepting.get(key)
  if (pending) return pending
  const operation = (async () => {
    const result = await api<{ accepted: boolean }>('/api/ext/billing/apple/verify', {
      signedTransactionInfo: transaction.signedTransactionInfo,
    })
    if (result.accepted !== true) throw new Error('APPLE_TRANSACTION_NOT_ACCEPTED')
    await bridge().finish({ transactionId: transaction.transactionId })
  })()
  accepting.set(key, operation)
  void operation.finally(() => accepting.delete(key)).catch(() => {})
  return operation
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

export async function purchaseApple(
  productId: string,
): Promise<'purchased' | 'pending' | 'cancelled'> {
  const plugin = bridge()
  // The server checks Stripe/Apple subscription conflicts BEFORE the Apple payment sheet opens.
  const prepared = await api<{
    productId: string
    appAccountToken: string
    checkoutToken?: string
  }>('/api/ext/billing/apple/prepare', { productId })
  if (
    prepared.productId !== productId ||
    !isUuid(prepared.appAccountToken) ||
    (prepared.checkoutToken !== undefined && !isUuid(prepared.checkoutToken))
  )
    throw new Error('APPLE_PURCHASE_NOT_PREPARED')
  const result = await plugin.purchase({
    productId: prepared.productId,
    appAccountToken: prepared.appAccountToken,
  })
  if (result.status === 'purchased') await accept(result.transaction)
  // Only a definite cancellation can release this specific subscription attempt's lease.
  // Consumables have no lease, and uncertain/pending results leave the lease to expire.
  if (result.status === 'cancelled' && prepared.checkoutToken)
    await api('/api/ext/billing/apple/cancel', { checkoutToken: prepared.checkoutToken })
  return result.status
}

async function acceptAll(transactions: AppleTransaction[]): Promise<void> {
  // One account-mismatched transaction must not prevent processing another valid purchase.
  const results = await Promise.allSettled(transactions.map(accept))
  const failure = results.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
}

/** User action only. Consumable balances come from the server ledger, not Apple's entitlements. */
export async function restoreApplePurchases(): Promise<void> {
  await acceptAll((await bridge().restore()).transactions)
}

export async function manageAppleSubscriptions(): Promise<void> {
  await bridge().manageSubscriptions()
}

/** Mount only for a signed-in user, and dispose on logout/account change. Failed transactions stay
 * unfinished in StoreKit for a later replay. No signed transaction or account token is persisted. */
export async function watchAppleTransactions(
  onAccepted: () => void,
  onError: (error: unknown) => void,
): Promise<() => void> {
  const plugin = bridge()
  let stopped = false
  let replaying = false
  const handle = async (transactions: AppleTransaction[]) => {
    if (stopped) return
    try {
      await acceptAll(transactions)
      if (!stopped && transactions.length) onAccepted()
    } catch (error) {
      if (!stopped) onError(error)
    }
  }
  // Subscribe before replay so an approval arriving during startup cannot be missed.
  const listener = await plugin.addListener('transactionUpdated', (transaction) => {
    void handle([transaction])
  })
  const replay = async () => {
    if (stopped || replaying) return
    replaying = true
    try {
      await handle((await plugin.unfinished()).transactions)
    } catch (error) {
      if (!stopped) onError(error)
    } finally {
      replaying = false
    }
  }
  const visible = () => {
    if (document.visibilityState === 'visible') void replay()
  }
  window.addEventListener('online', replay)
  document.addEventListener('visibilitychange', visible)
  void replay()
  return () => {
    stopped = true
    window.removeEventListener('online', replay)
    document.removeEventListener('visibilitychange', visible)
    void listener.remove().catch(() => {})
  }
}
