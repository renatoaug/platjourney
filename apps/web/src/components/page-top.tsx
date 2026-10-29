/** A screen's top: the eyebrow, the title and a line on the left, a card on the right, straight on a
 * game's art that runs across the top of the screen (the backdrop), and the screen's own controls
 * under the line (a search, filters). */
import type { ReactNode } from 'react'
import { GameBackdrop } from './game-backdrop'
import './page-top.css'

export function PageTop({
  eyebrow,
  title,
  lead,
  art,
  tint,
  aside,
  children,
}: {
  eyebrow?: string
  title: string
  lead?: ReactNode
  /** The picture across the top; none leaves the page's own background. */
  art?: string | null
  tint?: string | null
  /** The card on the right (the guide of the day, the next platinum). */
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <>
      {art && <GameBackdrop src={art} tint={tint} />}
      <section className={`page-top${art ? ' on-art' : ''}`}>
        <div className="page-top-text">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {lead && <p>{lead}</p>}
          {children}
        </div>
        {aside && <div className="page-top-aside">{aside}</div>}
      </section>
    </>
  )
}
