/** Behind the sign-in screen: the covers of the best rated games with a guide, in tilted rows that
 * drift slowly in turns, under a fade to the page. Says, before a word is read, what the app is for.
 * `onCount` gets how many guides there are, for the copy. */
import { useEffect, useState } from 'react'
import './cover-wall.css'

type Showcase = { covers: string[]; guides: number }

// Rows on the wall; each repeats its covers so its drift never shows an end.
const ROWS = 4

export function CoverWall({
  load = () => fetch('/api/auth/showcase').then((r) => (r.ok ? r.json() : null)),
  onCount,
}: {
  load?: () => Promise<Showcase | null>
  onCount?: (guides: number) => void
}) {
  const [covers, setCovers] = useState<string[]>([])
  useEffect(() => {
    let live = true
    load()
      .then((s) => {
        if (!live || !s?.covers.length) return
        setCovers(s.covers)
        onCount?.(s.guides)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [load, onCount])
  if (!covers.length) return null
  const per = Math.ceil(covers.length / ROWS)
  return (
    <div className="cover-wall" aria-hidden="true">
      <div className="cover-wall-tilt">
        {Array.from({ length: ROWS }, (_, r) => {
          const row = covers.slice(r * per, r * per + per)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the rows are fixed
            <div key={r} className={`cover-wall-row${r % 2 ? ' back' : ''}`}>
              {[...row, ...row].map((url, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a row repeats its covers
                <img key={i} src={url} alt="" loading="lazy" />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
