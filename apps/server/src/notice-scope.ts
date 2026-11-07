/** Whether the notice being prepared got written to the player's history. The tip log marks it,
 * so a notice written by Nexo, by a plain template or by the fallback after a failed model call
 * counts the same, and one given up before the write does not. */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface NoticeState {
  written: boolean
}

const scope = new AsyncLocalStorage<NoticeState>()

/** Runs `run` as one notice, marking `state` when anything in it reaches the history. */
export function inNotice<T>(state: NoticeState, run: () => Promise<T>): Promise<T> {
  return scope.run(state, run)
}

/** Called by the tip log once a notice is stored. Outside a notice it does nothing. */
export function noticeWritten(): void {
  const state = scope.getStore()
  if (state) state.written = true
}
