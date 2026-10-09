/** Where a piece of advice came from: a bookmark icon and the source names, under a divider. */
import type { ReactNode } from 'react'
import { Icon } from './icon'
import './source-note.css'

// A cited source Nexo links to its page or to the video minute: "[Site](https://...)", https only.
const LINK = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g

function withLinks(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    out.push(
      <a key={at} href={m[2]} target="_blank" rel="noopener noreferrer">
        {m[1]}
      </a>,
    )
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function SourceNote({ text }: { text: string }) {
  return (
    <div className="source-note">
      <Icon name="bookmark" />
      <span>{withLinks(text)}</span>
    </div>
  )
}

/** Nexo ends answers with a "Fonte: ..." line; split it off so it renders as a source note. */
export function splitSource(content = ''): [string, string | null] {
  const m = content.match(/\n\s*(Fontes?:[^\n]+)\s*$/)
  return m && m.index !== undefined ? [content.slice(0, m.index), m[1].trim()] : [content, null]
}
