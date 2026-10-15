/** What plugins add to the interface, from the `platjourney-plugins` module chosen at build time
 * (PLUGINS_WEB): changes around any of the app's components (extend.ts), whole pages (a route and
 * an item in the menu), and the action shown when the server refuses model work. A plain build has
 * none of them. */

import loaded from 'platjourney-plugins'
import { type ComponentType, createElement } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ErrorState } from '../ui/states'
import { type Extension, install } from './extend'
import { guarded } from './guard'
import type { Target } from './targets'

/** @public part of the plugin API */
export type { ReplaceProps } from './extend'
/** @public part of the plugin API */
export type { Target } from './targets'

export interface PluginPage {
  /** The route, e.g. '/hello'. */
  path: string
  /** The menu item and page title, in every language. */
  label: Record<Language, string>
  /** An icon name from the app's set (`ui/icon`). */
  icon: string
  component: ComponentType
}

/** A refusal from the server (a plugin threw Refused): its code and the message already shown. */
export interface PluginRefusal {
  code: string
  message: string
}

/** A plugin names the app's components it changes; a name the app no longer has fails its typecheck. */
export interface PluginModule extends Extension<Target> {
  pages?: PluginPage[]
  /** The button next to a refusal's message, e.g. a link to the page where the player can fix it. */
  refusalAction?: (refusal: PluginRefusal) => { href: string; label: string } | undefined
}

/** A web module exports one plugin, or a list of them. */
export const plugins: PluginModule[] = [loaded].flat()
install(plugins)

const messages = defineMessages({
  [Language.PtBR]: { pageFailed: 'Esta página não abriu. Tente de novo mais tarde.' },
  [Language.En]: { pageFailed: 'This page did not open. Try again later.' },
})

function PluginPageFailed() {
  const t = useMessages(messages)
  return createElement(
    ErrorState,
    // The text goes in as the element's child, the way createElement takes children.
    { icon: 'warning' } as Parameters<typeof ErrorState>[0],
    t('pageFailed'),
  )
}

// A plugin's page that throws shows an error state inside the app's frame, not a blank app.
export const guardedPage = (page: PluginPage): PluginPage => ({
  ...page,
  component: () =>
    guarded(page.component, {}, `page ${page.path}`, createElement(PluginPageFailed)),
})

export const pluginPages: PluginPage[] = plugins.flatMap((p) => p.pages ?? []).map(guardedPage)

/** The first plugin's action for a refusal, if any offers one. */
export function refusalAction(refusal: PluginRefusal) {
  return plugins.map((p) => p.refusalAction?.(refusal)).find(Boolean)
}

/** Fired on `window` after the app finished model work for the player (an answer, a plan, a batch
 * of recommendations), so a plugin's component can refresh what it shows. */
export const MODEL_WORK_DONE = 'platjourney:model-work-done'

export function modelWorkDone(): void {
  window.dispatchEvent(new Event(MODEL_WORK_DONE))
}
