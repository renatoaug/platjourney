/** Text helpers: HTML escaping and the small markdown Nexo writes (rendered as trusted HTML after escaping). */

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c: string) => ENTITIES[c] ?? c)

// Keep generated text free of decorative emoji; the interface uses SVG icons.
const EMOJI =
  /(?:[0-9#*]\uFE0F?\u20E3)|(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\uFE0F|\u200D)/gu

/** Generated text for a React text node (React escapes it). */
export const plainText = (value: unknown) => String(value ?? '').replace(EMOJI, '')

/** Generated text for an HTML string. */
export const uiText = (value: unknown) => esc(plainText(value))

// What the player sent: plain text, with **bold** kept (the trophy tips name the trophy that way).
export const userText = (value: unknown) =>
  uiText(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

// Nexo's replies come as light markdown: bold, italics, bullet lists, paragraphs.
export const md = (value: unknown): string => {
  const text = uiText(value)
  const bullet = /^\s*(?:[-*•]|\d+[.)])\s+/
  // A block can mix a heading line ("Como pegar:") with the list right under it.
  const blocks = text.split(/\n{2,}/).map((block) => {
    const out: string[] = []
    let items: string[] = []
    let para: string[] = []
    const flush = () => {
      if (para.length) out.push(`<p>${para.join('<br>')}</p>`)
      if (items.length) out.push(`<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`)
      para = []
      items = []
    }
    for (const line of block.split('\n')) {
      if (bullet.test(line)) {
        if (para.length) flush()
        items.push(line.replace(bullet, ''))
      } else {
        if (items.length) flush()
        para.push(line)
      }
    }
    flush()
    return out.join('')
  })
  return (
    blocks
      .join('')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Older messages quote trophy names instead of bolding them; highlight those too.
      .replace(/(?<!<strong>)“([^”<]{2,60})”(?!<\/strong>)/g, '<strong>“$1”</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  )
}
