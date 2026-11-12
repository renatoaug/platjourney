/** A trophy in its tier, as rendered art in the console's spirit (our own drawing, not the
 * console's): the platinum a blue orb in silver petals, gold, silver and bronze cups. Sized like
 * `Icon` (the `icon` class), so it drops in wherever a trophy's type is known. */
import './trophy-medal.css'

export type TrophyTier = 'platinum' | 'gold' | 'silver' | 'bronze'

const TIERS: TrophyTier[] = ['platinum', 'gold', 'silver', 'bronze']

export function TrophyMedal({
  type,
  className,
  title,
}: {
  type: TrophyTier | string
  className?: string
  /** Read by screen readers; without it the art is decoration. */
  title?: string
}) {
  const tier = (TIERS.includes(type as TrophyTier) ? type : 'bronze') as TrophyTier
  return (
    <img
      className={`icon trophy-medal is-${tier}${className ? ` ${className}` : ''}`}
      src={`/trophies/${tier}.webp`}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  )
}
