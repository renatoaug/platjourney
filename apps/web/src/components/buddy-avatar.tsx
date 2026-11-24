/** The player's buddy, wherever Nexo's face shows. Nexo stays its own drawing; an object comes
 * alive: it breathes, blinks, glances aside and, now and then, plays its two gestures. It is always
 * one `<img>`, so each screen's sizing and its own animations keep working. Still under reduced
 * motion. */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { BUDDY_GESTURES, type Buddy, type BuddyMotion } from '../../../../shared/buddy'
import { getBuddy, subscribeBuddy, useBuddyName } from '../lib/buddy'
import './buddy-avatar.css'

type Frame = 'base' | 'blink' | 'look' | 'a' | 'b'

/** One round of a buddy's life: [seconds from the start, face, how long]. Rests in between. */
const ROUND: [number, Frame, number][] = [
  [1.5, 'blink', 0.15],
  [2.8, 'look', 1.4],
  [4.2, 'blink', 0.15],
  [5.6, 'a', 1.3],
  [6.9, 'blink', 0.15],
  [8.2, 'b', 1.0],
  [9.6, 'blink', 0.15],
]
const ROUND_SECONDS = 10.5

const FRAMES: Frame[] = ['base', 'blink', 'look', 'a', 'b']
const buddySrc = (buddy: Exclude<Buddy, 'nexo'>, frame: Frame = 'base') =>
  `/buddies/${buddy}/${frame}.webp`

const still = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Plays the round over and over from a random point, so two buddies on screen never sync. */
function useLife(buddy: Buddy): Frame {
  const [frame, setFrame] = useState<Frame>('base')
  useEffect(() => {
    setFrame('base')
    if (buddy === 'nexo' || still()) return
    for (const f of FRAMES) new Image().src = buddySrc(buddy, f)
    let timer: ReturnType<typeof setTimeout>
    let start = performance.now() / 1000 - Math.random() * ROUND_SECONDS
    const tick = () => {
      let at = performance.now() / 1000 - start
      if (at >= ROUND_SECONDS) {
        start += ROUND_SECONDS
        at -= ROUND_SECONDS
      }
      const now = ROUND.find(([from, , length]) => at >= from && at < from + length)
      setFrame(now ? now[1] : 'base')
      const next = now ? now[0] + now[2] : (ROUND.find(([from]) => from > at)?.[0] ?? ROUND_SECONDS)
      timer = setTimeout(tick, Math.max(16, (next - at) * 1000))
    }
    tick()
    return () => clearTimeout(timer)
  }, [buddy])
  return frame
}

export function BuddyAvatar({
  className,
  buddy: chosen,
  blink = false,
  width,
  height,
}: {
  className?: string
  /** A buddy to draw instead of the player's (Settings' picker). */
  buddy?: Buddy
  /** Nexo's own blink, for the screens that already ask for it. */
  blink?: boolean
  width?: number | string
  height?: number | string
}) {
  const mine = useSyncExternalStore(subscribeBuddy, getBuddy, getBuddy).buddy
  const buddy = chosen ?? mine
  const frame = useLife(buddy)
  if (buddy === 'nexo')
    return (
      <img
        className={className}
        src={blink ? '/nexo-avatar.svg#blink' : '/nexo-avatar.svg'}
        alt=""
        width={width}
        height={height}
        draggable={false}
      />
    )
  const [first, second] = BUDDY_GESTURES[buddy]
  const motion: BuddyMotion | 'breathe' = frame === 'a' ? first : frame === 'b' ? second : 'breathe'
  return (
    <img
      className={className ? `buddy-avatar ${className}` : 'buddy-avatar'}
      data-buddy-motion={motion}
      src={buddySrc(buddy, frame)}
      alt=""
      width={width}
      height={height}
      draggable={false}
    />
  )
}

/** The buddy's name as text, where a screen writes it by itself (a heading, an author line). */
export function BuddyName({ as: Tag = 'span' }: { as?: 'span' | 'h1' }) {
  return <Tag>{useBuddyName()}</Tag>
}
