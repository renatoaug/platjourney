/** A translated sentence that bolds a part of itself: the message wraps it in <b>…</b>, the only
 * markup messages carry. Anything else in it renders as text. */
export function BoldText({ text }: { text: string }) {
  const parts = text.split(/<b>(.*?)<\/b>/)
  return (
    <>
      {parts.map((part, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed sentence.
        i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>,
      )}
    </>
  )
}
