/** A game's art across the whole top of the screen, behind the top bar and the hero, still and
 * fading into the page. With scenes from the catalog it shows one, and `ScenesButton` opens them over
 * the whole screen (the backdrop follows the one picked there). It sits in the app frame rather than in the page,
 * so it reaches the edges of the content column whatever the page's own width. */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { tintStyle } from '../lib/tint'
import { Icon } from '../ui/icon'
import { GalleryLightbox, image } from './game-showcase'
import './game-backdrop.css'

const messages = defineMessages({
  [Language.PtBR]: { scenes: { one: 'Ver imagem', other: 'Ver {count} imagens' } },
  [Language.En]: { scenes: { one: 'See image', other: 'See {count} images' } },
})

/** The scene in the backdrop: the first, until the player moves through them full screen. */
export function useScene(count: number) {
  const [at, setAt] = useState(0)
  return [at, (i: number) => setAt(((i % count) + count) % count)] as const
}

export function GameBackdrop({
  src,
  shots = [],
  at = 0,
  tint,
}: {
  /** The art when there are no scenes. */
  src?: string | null
  /** IGDB screenshot ids. */
  shots?: string[]
  at?: number
  tint?: string | null
}) {
  const [frame, setFrame] = useState<HTMLElement | null>(null)
  const [last, setLast] = useState<string | null>(null)
  useEffect(() => setFrame(document.getElementById('app')), [])
  const now = shots.length ? image(shots[at % shots.length], 't_1080p') : (src ?? null)
  // The scene before stays under the new one while it fades in.
  useEffect(() => {
    if (!now) return
    const timer = setTimeout(() => setLast(now), 1600)
    return () => clearTimeout(timer)
  }, [now])
  if (!frame) return null
  return createPortal(
    <div className="game-backdrop tinted" style={tintStyle(tint)} aria-hidden="true">
      {last && last !== now && <img className="was" src={last} alt="" />}
      {now && <img key={now} className="now" src={now} alt="" />}
    </div>,
    frame,
  )
}

/** Opens the game's scenes over the whole screen, at the one in the backdrop. */
export function ScenesButton({
  shots,
  at,
  name,
  onGo,
}: {
  shots: string[]
  at: number
  name: string
  onGo: (i: number) => void
}) {
  const t = useMessages(messages)
  const [open, setOpen] = useState(false)
  if (!shots.length) return null
  return (
    <>
      <button type="button" className="scenes-button" onClick={() => setOpen(true)}>
        <Icon name="expand" /> {t('scenes', { count: shots.length })}
      </button>
      {open && (
        <GalleryLightbox
          ids={shots}
          at={at}
          name={name}
          onGo={onGo}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
