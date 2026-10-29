/** The game page's sections in a bar that sticks to the top while scrolling: the part in view is lit,
 * and once the hero is gone the bar carries the game's name and progress, so the page never loses
 * what it is about. Only sections on the page get a link. */
import { useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { pct } from '../lib/format'
import { useSlide } from '../ui/use-slide'
import './game-nav.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Seções do jogo',
    plan: 'Sessão',
    guide: 'Guia',
    trophies: 'Troféus',
  },
  [Language.En]: {
    label: 'Game sections',
    plan: 'Session',
    guide: 'Guide',
    trophies: 'Trophies',
  },
})

export type GameSection = 'plan' | 'guide' | 'trophies'

// On a phone the guide and the trophies take turns behind a switch: a hidden one scrolls to the pair.
const scrollTo = (id: string) => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const el = document.getElementById(id)
  const target = el && !el.offsetParent ? el.closest('.game-columns-wrap') : el
  target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

export function GameNav({
  sections,
  hero,
  name,
  progress,
}: {
  /** Each section and the id of the element it scrolls to. */
  sections: [GameSection, string][]
  /** The hero's id: the bar shows the name once it scrolls away. */
  hero: string
  name: string
  progress?: number | null
}) {
  const t = useMessages(messages)
  const [present, setPresent] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [stuck, setStuck] = useState(false)
  const ids = sections.map(([, id]) => id).join(' ')

  // Sections come and go as their data loads: the links follow the page.
  useEffect(() => {
    const list = ids.split(' ')
    const check = () => setPresent(list.filter((id) => document.getElementById(id)))
    check()
    const page = document.querySelector('.page.active') ?? document.body
    const observer = new MutationObserver(check)
    observer.observe(page, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [ids])

  // The lit link is the section under the bar; a picked one holds until its scroll ends, so a short
  // section is not passed over for the next one.
  const picked = useRef<string | null>(null)
  useEffect(() => {
    const els = present.map((id) => document.getElementById(id)).filter((e) => e !== null)
    const heroEl = document.getElementById(hero)
    let settle: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      setStuck(heroEl ? heroEl.getBoundingClientRect().bottom < 80 : false)
      if (picked.current) {
        clearTimeout(settle)
        settle = setTimeout(() => {
          picked.current = null
        }, 160)
        return
      }
      const line = 120
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const under = els.filter((e) => e.getBoundingClientRect().top <= line)
      setActive(atEnd && els.length ? els[els.length - 1].id : (under.at(-1)?.id ?? null))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(settle)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [present, hero])

  const track = useSlide<HTMLUListElement>(`${active}|${present.length}`)
  const shown = sections.filter(([, id]) => present.includes(id))
  if (shown.length < 2) return null
  return (
    <nav className={`game-nav${stuck ? ' stuck' : ''}`} aria-label={t('label')}>
      <div className="game-nav-game" aria-hidden={!stuck}>
        <b>{name}</b>
        {progress != null && (
          <span className="game-nav-progress">
            <i style={{ width: `${pct(progress)}%` }} />
          </span>
        )}
        {progress != null && <span className="game-nav-pct">{progress}%</span>}
      </div>
      <ul ref={track}>
        {shown.map(([key, id]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                picked.current = id
                setActive(id)
                scrollTo(id)
              }}
            >
              {t(key)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
