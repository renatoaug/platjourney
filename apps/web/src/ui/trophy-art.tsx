import { useState } from 'react'
import { Icon } from './icon'

/** A trophy's icon, or the trophy symbol when there is none or PSN no longer serves the file. */
export function TrophyArt({ url, className }: { url?: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (!url || broken) return <Icon name="trophy" />
  return (
    <img className={className} src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
  )
}
