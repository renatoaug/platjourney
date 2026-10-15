import { AsyncLocalStorage } from 'node:async_hooks'

// Who and what caused the model calls made inside a piece of work. Set once at
// the edges (a web request, a watcher pass, a feature) and sent with every call to
// the AI service, which records each call's cost, so no function in between needs
// extra parameters.
interface CostTag {
  user?: string
  action?: string
  // Work for the demo player, which must never reach PSN or the AI service.
  demo?: boolean
}
const store = new AsyncLocalStorage<CostTag>()

export function tagged<T>(tag: CostTag, work: () => Promise<T>): Promise<T> {
  return store.run({ ...store.getStore(), ...tag }, work)
}

export const currentTag = (): CostTag => store.getStore() ?? {}
