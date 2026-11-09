import { useState } from 'react'
import { Icon } from './icon'

/** A trophy's icon, or the trophy symbol when there is none or PSN no longer serves the file.
 * `eager` fetches it right away: for icons hidden in a strip that slides into view (the journey's
 * route), where waiting for them to scroll in shows a blank ring after each arrow. */
export function TrophyArt({
  url,
  className,
  eager = false,
}: {
  url?: string | null
  className?: string
  eager?: boolean
}) {
  const [broken, setBroken] = useState(false)
  if (!url || broken) return <Icon name="trophy" />
  return (
    <img
      className={className}
      src={url}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setBroken(true)}
    />
  )
}
