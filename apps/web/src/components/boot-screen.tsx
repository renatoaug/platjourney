/** While the app starts: the name on top, Nexo with the controller's four buttons around it,
 * pressed one after the other, the buttons' symbols drifting up behind, a line that changes as it
 * waits and, after a second of waiting, a trophy for the patience. Covers the screen until the first data arrives, then
 * fades out (`leaving`). */
import { useEffect, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import './boot-screen.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Carregando o PlatJourney',
    line: {
      controller: 'Ligando o controle',
      trophies: 'Buscando seus troféus',
      nexo: 'Acordando o Nexo',
      polish: 'Polindo suas platinas',
      bronze: 'Contando os bronzes',
      missables: 'Caçando perdíveis',
    },
    unlocked: 'Troféu desbloqueado',
    trophy: 'Paciência de platinador',
  },
  [Language.En]: {
    label: 'Loading PlatJourney',
    line: {
      controller: 'Turning on the controller',
      trophies: 'Fetching your trophies',
      nexo: 'Waking Nexo up',
      polish: 'Polishing your platinums',
      bronze: 'Counting the bronzes',
      missables: 'Hunting missables',
    },
    unlocked: 'Trophy unlocked',
    trophy: "A platinum hunter's patience",
  },
})

// One full turn of the four buttons; the line changes with it.
const TURN_MS = 1600
const LINES = [
  'line.controller',
  'line.trophies',
  'line.polish',
  'line.bronze',
  'line.missables',
  'line.nexo',
] as const
// The screen shows for a moment only: the trophy drops in almost at once.
const TROPHY_MS = 300
// The symbols drifting up behind: which one, where across the screen and how far into its rise it
// already is (a negative delay), so the screen opens with all of them on it.
const DRIFT = [
  ['triangle', 8, -1.5],
  ['circle', 22, -4.4],
  ['cross', 38, -2.8],
  ['square', 61, -5.6],
  ['triangle', 76, -0.8],
  ['circle', 90, -3.6],
  ['cross', 50, -6.3],
  ['square', 30, -5],
] as const

const KEYS = [
  { name: 'triangle', shape: <path d="M10 3 17.5 16h-15Z" /> },
  { name: 'circle', shape: <circle cx="10" cy="10" r="7" /> },
  { name: 'cross', shape: <path d="m4 4 12 12M16 4 4 16" /> },
  { name: 'square', shape: <rect x="3.5" y="3.5" width="13" height="13" rx="1" /> },
]

export function BootScreen({ leaving = false }: { leaving?: boolean }) {
  const t = useMessages(messages)
  const [line, setLine] = useState(0)
  const [trophy, setTrophy] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setLine((n) => (n + 1) % LINES.length), TURN_MS)
    const unlock = setTimeout(() => setTrophy(true), TROPHY_MS)
    return () => {
      clearInterval(id)
      clearTimeout(unlock)
    }
  }, [])
  // The page under it stays still while it shows (boot-screen.css); scrolling comes back as soon
  // as it starts to fade, and whatever happens to it, once it is gone.
  useEffect(() => {
    if (leaving) return
    const html = document.documentElement
    html.dataset.booting = ''
    return () => {
      delete html.dataset.booting
    }
  }, [leaving])
  return (
    <div
      className={`boot-screen${leaving ? ' leaving' : ''}`}
      role="status"
      aria-label={t('label')}
    >
      <div className="boot-drift" aria-hidden="true">
        {DRIFT.map(([name, left, delay]) => (
          <svg
            key={`${name}-${left}`}
            viewBox="0 0 20 20"
            aria-hidden="true"
            style={{ left: `${left}%`, animationDelay: `${delay}s` }}
          >
            {KEYS.find((k) => k.name === name)?.shape}
          </svg>
        ))}
      </div>
      {trophy && (
        <div className="boot-trophy" aria-hidden="true">
          <span className="boot-trophy-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1M12 13v4M9 20h6M10 17h4" />
            </svg>
          </span>
          <span>
            <small>{t('unlocked')}</small>
            <b>{t('trophy')}</b>
          </span>
        </div>
      )}
      <span className="boot-brand" aria-hidden="true">
        <img src="/logo.svg" alt="" width="28" height="28" />
        <span>
          plat<span className="boot-brand-accent">journey</span>
        </span>
      </span>
      <div className="boot-stage" aria-hidden="true">
        {KEYS.map((k) => (
          <span key={k.name} className={`boot-key boot-key-${k.name}`}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {k.shape}
            </svg>
          </span>
        ))}
        <img className="boot-nexo" src="/nexo-avatar.svg" alt="" />
      </div>
      <span className="boot-bar" aria-hidden="true" />
      <span className="boot-line" aria-hidden="true">
        {t(LINES[line])}
      </span>
    </div>
  )
}
