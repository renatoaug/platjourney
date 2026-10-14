/** The development twin of jsx-runtime.ts. */
import { Fragment, jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime'
import { extended } from './extend'

export type { JSX } from 'react/jsx-runtime'
export { Fragment }

export function jsxDEV(
  type: unknown,
  props: unknown,
  key: string | undefined,
  isStatic: boolean,
  source?: unknown,
  self?: unknown,
) {
  return reactJsxDEV(extended(type) as never, props as never, key, isStatic, source as never, self)
}
