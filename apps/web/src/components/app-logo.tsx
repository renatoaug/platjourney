/** An assistant's mark (Claude, ChatGPT), found by the name it registered with or is shown by; any
 * other gets a plain icon. Decorative: the text beside it names the assistant. */
import { Icon } from '../ui/icon'
import './app-logo.css'

// The assistants people connect most: their marks (Simple Icons, CC0) and the key of the page where
// a connector is added.
export const ASSISTANTS = [
  { key: 'claude', name: 'Claude', match: /claude/i, logo: '/claude.svg' },
  { key: 'chatgpt', name: 'ChatGPT', match: /chatgpt|openai|codex/i, logo: '/chatgpt.svg' },
] as const
export type Assistant = (typeof ASSISTANTS)[number]

/** An assistant's name from the key the server stores ('claude', 'chatgpt'); null for 'other'. */
export const assistantName = (key?: string | null): string | null =>
  ASSISTANTS.find((a) => a.key === key)?.name ?? null

export function AppLogo({ name }: { name: string }) {
  const logo = ASSISTANTS.find((a) => a.match.test(name))?.logo
  return logo ? (
    <img className="app-logo" src={logo} alt="" />
  ) : (
    <span className="app-logo app-logo-plain">
      <Icon name="layers" />
    </span>
  )
}
