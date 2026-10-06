import './cover.css'
/** Game cover, or a lettered placeholder when no store has art for the game. */
export function Cover({
  url,
  name,
  className = '',
}: {
  url?: string | null
  name?: string | null
  className?: string
}) {
  if (url) return <img className={className} src={url} alt="" loading="lazy" />
  return (
    <span className={`${className} cover-placeholder`.trim()} aria-hidden="true">
      {String(name ?? '?')
        .trim()
        .charAt(0)
        .toUpperCase()}
    </span>
  )
}
