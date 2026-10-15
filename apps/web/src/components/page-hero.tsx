/** The top of a list page: game art behind a fade, a large title and the lead, with room for a
 * search or actions. Each page arranges its art its own way, so they share the fade without
 * looking the same: tilted covers (Guides), a shelf of the player's own covers (Interests) and
 * wide artworks (Discover). */
import type { ReactNode } from 'react'
import './page-hero.css'

type HeroLook = 'covers' | 'shelf' | 'art'

export function PageHero({
  eyebrow,
  title,
  lead,
  images,
  look,
  children,
}: {
  eyebrow?: string
  title: string
  lead?: string
  images: string[]
  look: HeroLook
  children?: ReactNode
}) {
  // A shelf reads as one row; tilted covers and artworks are repeated to fill the whole top.
  const art =
    look === 'shelf'
      ? images.slice(0, 8)
      : images.length
        ? [...images, ...images].slice(0, look === 'art' ? 12 : 21)
        : []
  return (
    <section className={`page-hero is-${look}`}>
      {art.length > 0 && (
        <div className="page-hero-art" aria-hidden="true">
          {art.map((url, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the same image may repeat to fill the top
            <img key={`${i}-${url}`} src={url} alt="" loading="lazy" />
          ))}
        </div>
      )}
      <div className="page-hero-inner">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
        {children}
      </div>
    </section>
  )
}
