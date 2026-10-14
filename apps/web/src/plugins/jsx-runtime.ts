/** The JSX runtime the app compiles with (Vite's `jsxImportSource`): React's own, with each
 * element's component passed through the plugins' rules first (extend.ts). */
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime'
import { extended } from './extend'

export type { JSX } from 'react/jsx-runtime'
export { Fragment }

// Declarations, not consts: modules that run while this one is still loading can call them.
export function jsx(type: unknown, props: unknown, key?: string) {
  return reactJsx(extended(type) as never, props as never, key)
}

export function jsxs(type: unknown, props: unknown, key?: string) {
  return reactJsxs(extended(type) as never, props as never, key)
}
