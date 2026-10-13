/** Under a game's hero: its scenes in a gallery and what it is (genres, studio, release, platforms,
 * official site), all from the catalog. A game without either shows nothing. */
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useLocale, useMessages } from '../i18n/i18n'
import { fmtRelease } from '../lib/format'
import type { Game } from '../lib/types'
import { Cover } from '../ui/cover'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import './game-showcase.css'

const messages = defineMessages({
  [Language.PtBR]: {
    gallery: 'Imagens de {name}',
    shot: 'Imagem {n} de {total}',
    prev: 'Imagem anterior',
    next: 'Próxima imagem',
    expand: 'Ver em tela cheia',
    close: 'Fechar',
    count: '{n} de {total}',
    about: 'Sobre {name}',
    developer: { one: 'Desenvolvedor', other: 'Desenvolvedores' },
    released: 'Lançamento',
    platforms: 'Plataformas',
    site: 'Site oficial',
    modes: 'Modos',
    rating: 'Nota da crítica',
    ratingValue: '{value}/100',
  },
  [Language.En]: {
    gallery: 'Images of {name}',
    shot: 'Image {n} of {total}',
    prev: 'Previous image',
    next: 'Next image',
    expand: 'View full screen',
    close: 'Close',
    count: '{n} of {total}',
    about: 'About {name}',
    developer: { one: 'Developer', other: 'Developers' },
    released: 'Release',
    platforms: 'Platforms',
    site: 'Official site',
    modes: 'Modes',
    rating: 'Critic score',
    ratingValue: '{value}/100',
  },
})

// IGDB genre names, as players call them here. A genre not listed shows as IGDB names it.
const GENRES_PT: Record<string, string> = {
  Adventure: 'Aventura',
  Arcade: 'Arcade',
  'Card & Board Game': 'Cartas e tabuleiro',
  Fighting: 'Luta',
  "Hack and slash/Beat 'em up": 'Hack and slash',
  Indie: 'Indie',
  MOBA: 'MOBA',
  Music: 'Música',
  Pinball: 'Pinball',
  Platform: 'Plataforma',
  'Point-and-click': 'Point-and-click',
  Puzzle: 'Puzzle',
  'Quiz/Trivia': 'Quiz',
  Racing: 'Corrida',
  'Real Time Strategy (RTS)': 'Estratégia em tempo real',
  'Role-playing (RPG)': 'RPG',
  Shooter: 'Tiro',
  Simulator: 'Simulação',
  Sport: 'Esporte',
  Strategy: 'Estratégia',
  Tactical: 'Tático',
  'Turn-based strategy (TBS)': 'Estratégia por turnos',
  'Visual Novel': 'Visual novel',
}

// IGDB game modes, as players call them here.
const MODES_PT: Record<string, string> = {
  'Single player': 'Um jogador',
  Multiplayer: 'Multijogador',
  'Co-operative': 'Cooperativo',
  'Split screen': 'Tela dividida',
  'Massively Multiplayer Online (MMO)': 'MMO',
  'Battle Royale': 'Battle royale',
}

const image = (id: string, size: string) =>
  `https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg`

/** A swipe shorter than this is a tap, not a change of image. */
const SWIPE_PX = 40

export function GameGallery({ ids, name }: { ids: string[]; name: string }) {
  const t = useMessages(messages)
  const [at, setAt] = useState(0)
  const [full, setFull] = useState(false)
  const start = useRef<number | null>(null)
  const thumbs = useRef<HTMLDivElement>(null)
  const total = ids.length
  // The chosen thumbnail stays in view as the images go by.
  useEffect(() => {
    const strip = thumbs.current
    const thumb = strip?.children[at] as HTMLElement | undefined
    if (strip && thumb)
      strip.scrollTo({
        left: thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2,
        behavior: 'smooth',
      })
  }, [at])
  if (!total) return null
  const go = (i: number) => setAt((i + total) % total)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(at - 1)
    if (e.key === 'ArrowRight') go(at + 1)
  }
  // A swipe changes the image; a tap opens it full screen.
  const onUp = (e: PointerEvent) => {
    if (start.current === null) return
    const dx = e.clientX - start.current
    start.current = null
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? at + 1 : at - 1)
    else if ((e.target as HTMLElement).tagName === 'IMG') setFull(true)
  }
  return (
    <section
      className="card gallery"
      aria-roledescription="carousel"
      aria-label={t('gallery', { name })}
      onKeyDown={onKey}
    >
      <div
        className="gallery-stage"
        onPointerDown={(e) => {
          start.current = e.clientX
        }}
        onPointerUp={onUp}
        onPointerCancel={() => {
          start.current = null
        }}
      >
        <img
          key={ids[at]}
          src={image(ids[at], 't_1080p')}
          alt={t('shot', { n: at + 1, total })}
          draggable={false}
        />
        <button
          type="button"
          className="gallery-expand"
          aria-label={t('expand')}
          data-tip={t('expand')}
          onClick={() => setFull(true)}
        >
          <Icon name="expand" />
        </button>
        {total > 1 && (
          <>
            <button
              type="button"
              className="gallery-nav prev"
              aria-label={t('prev')}
              onClick={() => go(at - 1)}
            >
              <Icon name="chevron-left" />
            </button>
            <button
              type="button"
              className="gallery-nav next"
              aria-label={t('next')}
              onClick={() => go(at + 1)}
            >
              <Icon name="chevron-right" />
            </button>
            <div className="gallery-dots" aria-hidden="true">
              {ids.map((id, i) => (
                <i key={id} className={i === at ? 'on' : ''} />
              ))}
            </div>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="gallery-thumbs" ref={thumbs}>
          {ids.map((id, i) => (
            <button
              key={id}
              type="button"
              className={i === at ? 'on' : ''}
              aria-label={t('shot', { n: i + 1, total })}
              aria-current={i === at}
              onClick={() => go(i)}
            >
              <img src={image(id, 't_screenshot_med')} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
      {full && (
        <GalleryLightbox ids={ids} at={at} name={name} onGo={go} onClose={() => setFull(false)} />
      )}
    </section>
  )
}

/** One image at a time over the whole screen. Esc, the close button or a click outside it closes. */
export function GalleryLightbox({
  ids,
  at,
  name,
  onGo,
  onClose,
}: {
  ids: string[]
  at: number
  name: string
  onGo: (i: number) => void
  onClose: () => void
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  const start = useRef<number | null>(null)
  const total = ids.length
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={t('gallery', { name })}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onKeyDown={(e) => {
        // The gallery behind would move too: this one is the only one listening.
        e.stopPropagation()
        if (e.key === 'ArrowLeft') onGo(at - 1)
        if (e.key === 'ArrowRight') onGo(at + 1)
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onPointerDown={(e) => {
        start.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (start.current === null) return
        const dx = e.clientX - start.current
        start.current = null
        if (Math.abs(dx) > SWIPE_PX) onGo(dx < 0 ? at + 1 : at - 1)
      }}
    >
      <img
        key={ids[at]}
        src={image(ids[at], 't_1080p')}
        alt={t('shot', { n: at + 1, total })}
        draggable={false}
      />
      <button type="button" className="lightbox-close" aria-label={t('close')} onClick={onClose}>
        <Icon name="close" />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            className="gallery-nav prev"
            aria-label={t('prev')}
            onClick={() => onGo(at - 1)}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            className="gallery-nav next"
            aria-label={t('next')}
            onClick={() => onGo(at + 1)}
          >
            <Icon name="chevron-right" />
          </button>
          <span className="lightbox-count">{t('count', { n: at + 1, total })}</span>
        </>
      )}
    </dialog>
  )
}

export function GameAbout({ game, name }: { game: Game; name: string }) {
  const t = useMessages(messages)
  const locale = useLocale()
  const genres = game.genres ?? []
  const developers = game.developers ?? []
  const platforms = (game.platforms ?? []).filter((p) => p === 'PS4' || p === 'PS5')
  const site = game.website ? safeUrl(game.website) : null
  const pt = locale === Language.PtBR
  const modes = (game.modes ?? []).map((m) => (pt ? (MODES_PT[m] ?? m) : m))
  if (!genres.length && !developers.length && !game.released_at && !platforms.length && !site)
    return null
  return (
    <section className="card game-about" aria-label={t('about', { name })}>
      <div className="game-about-head">
        {game.cover_url && <Cover url={game.cover_url} name={name} className="game-about-cover" />}
        <div className="game-about-title">
          <span className="eyebrow">{t('about', { name })}</span>
          {genres.length > 0 && (
            <div className="game-about-genres">
              {genres.map((g) => (
                <span key={g} className="pill ok">
                  {pt ? (GENRES_PT[g] ?? g) : g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <dl className="game-about-facts">
        {developers.length > 0 && (
          <div>
            <dt>{t('developer', { count: developers.length })}</dt>
            <dd>{developers.join(', ')}</dd>
          </div>
        )}
        {game.released_at && (
          <div>
            <dt>{t('released')}</dt>
            <dd>{fmtRelease(game.released_at)}</dd>
          </div>
        )}
        {modes.length > 0 && (
          <div>
            <dt>{t('modes')}</dt>
            <dd>{modes.join(', ')}</dd>
          </div>
        )}
        {game.rating != null && game.rating > 0 && (
          <div>
            <dt>{t('rating')}</dt>
            <dd>{t('ratingValue', { value: Math.round(game.rating) })}</dd>
          </div>
        )}
        {platforms.length > 0 && (
          <div>
            <dt>{t('platforms')}</dt>
            <dd className="game-about-platforms">
              {platforms.map((p) => (
                <span key={p} className="pill">
                  {p}
                </span>
              ))}
            </dd>
          </div>
        )}
        {site && (
          <div>
            <dt>{t('site')}</dt>
            <dd>
              <a href={site.href} target="_blank" rel="noopener noreferrer">
                {site.host} <Icon name="arrow" />
              </a>
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}

/** The gallery and the facts side by side; either one alone takes the whole width. */
export function GameShowcase({ game, name }: { game: Game; name: string }) {
  const ids = game.screenshot_ids ?? []
  return (
    <div className={`game-showcase${ids.length ? '' : ' no-gallery'}`}>
      <GameGallery ids={ids} name={name} />
      <GameAbout game={game} name={name} />
    </div>
  )
}

export function GameShowcaseSkeleton() {
  return (
    <div className="game-showcase">
      <div className="card gallery">
        <div className="gallery-stage">
          <Sk w="100%" h={0} style={{ aspectRatio: '16 / 9', height: 'auto' }} />
        </div>
      </div>
      <div className="card game-about">
        <Sk w="45%" h={10} />
        <Sk w="70%" h={20} />
        <Sk w="100%" h={12} />
        <Sk w="85%" h={12} />
        <Sk w="60%" h={12} />
      </div>
    </div>
  )
}

/** Only http(s) links from the catalog are shown, with the host as their text. */
function safeUrl(raw: string): { href: string; host: string } | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return { href: u.href, host: u.host.replace(/^www\./, '') }
  } catch {
    return null
  }
}
