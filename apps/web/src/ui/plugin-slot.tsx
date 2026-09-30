/** What plugins add to the interface, from the `platjourney-plugins` module chosen at build time:
 * components in named slots, whole pages (a route and an item in the menu), and the action shown
 * when the server refuses model work. A plain build has none of them. */

import plugins from 'platjourney-plugins'
import type { ComponentType } from 'react'
import type { Language } from '../i18n/locale'

export type PluginSlotName = 'top-bar' | 'profile'

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

export interface PluginModule {
  slots?: Partial<Record<PluginSlotName, ComponentType>>
  pages?: PluginPage[]
  /** The button next to a refusal's message, e.g. a link to the page where the player can fix it. */
  refusalAction?: (refusal: PluginRefusal) => { href: string; label: string } | undefined
}

export const pluginModule: PluginModule = plugins

/** Fired on `window` after the app finished model work for the player (an answer, a plan, a batch
 * of recommendations), so a plugin's component can refresh what it shows. */
export const MODEL_WORK_DONE = 'platjourney:model-work-done'

export function modelWorkDone(): void {
  window.dispatchEvent(new Event(MODEL_WORK_DONE))
}

export function PluginSlot({
  name,
  module = pluginModule,
}: {
  name: PluginSlotName
  module?: PluginModule
}) {
  const Filled = module.slots?.[name]
  return Filled ? <Filled /> : null
}
