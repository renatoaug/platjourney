/** Where a piece of advice came from: a bookmark icon and the source names, under a divider. */
import { Icon } from './icon'
import './source-note.css'

export function SourceNote({ text }: { text: string }) {
  return (
    <div className="source-note">
      <Icon name="bookmark" />
      <span>{text}</span>
    </div>
  )
}

/** Nexo ends answers with a "Fonte: ..." line; split it off so it renders as a source note. */
export function splitSource(content = ''): [string, string | null] {
  const m = content.match(/\n\s*(Fontes?:[^\n]+)\s*$/)
  return m && m.index !== undefined ? [content.slice(0, m.index), m[1].trim()] : [content, null]
}
