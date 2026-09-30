/** Text Nexo or the guides wrote: escaped first, then the small markdown (bold, italics, lists) rendered as HTML. */
import { md, userText } from '../lib/text'

export function Markdown({
  text,
  className,
  as: Tag = 'div',
}: {
  text: string
  className?: string
  as?: 'div' | 'span'
}) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: md() escapes the text before adding its own tags
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: md(text) }} />
}

/** What the player typed: plain text with **bold** kept. */
export function UserText({ text, className }: { text: string; className?: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: userText() escapes the text before adding <strong>
  return <span className={className} dangerouslySetInnerHTML={{ __html: userText(text) }} />
}
