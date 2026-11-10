import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

// The icon sprite (public/icons.svg) goes into the page itself, so an <Icon> refers to a symbol
// already in the document. Pointing at /icons.svg instead depends on one request per page: when it
// is slow or fails, every icon stays blank until a reload. The ids get an "icon-" prefix, so no
// other id on a page takes them.
export function inlineIcons(): Plugin {
  const file = new URL('public/icons.svg', import.meta.url)
  return {
    name: 'inline-icons',
    transformIndexHtml: () => [
      {
        tag: 'div',
        attrs: { id: 'icon-sprite', hidden: true },
        children: readFileSync(file, 'utf8').replaceAll('<symbol id="', '<symbol id="icon-'),
        injectTo: 'body-prepend',
      },
    ],
  }
}
