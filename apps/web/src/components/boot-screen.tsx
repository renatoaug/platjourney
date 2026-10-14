/** While the app starts: Nexo with the controller's four buttons around it, pressed one after the
 * other, and a line that changes as it waits. Covers the screen until the first data arrives, then
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
    },
  },
  [Language.En]: {
    label: 'Loading PlatJourney',
    line: {
      controller: 'Turning on the controller',
      trophies: 'Fetching your trophies',
      nexo: 'Waking Nexo up',
    },
  },
})

// One full turn of the four buttons; the line changes with it.
const TURN_MS = 1600
const LINES = ['line.controller', 'line.trophies', 'line.nexo'] as const

const KEYS = [
  { name: 'triangle', shape: <path d="M10 3 17.5 16h-15Z" /> },
  { name: 'circle', shape: <circle cx="10" cy="10" r="7" /> },
  { name: 'cross', shape: <path d="m4 4 12 12M16 4 4 16" /> },
  { name: 'square', shape: <rect x="3.5" y="3.5" width="13" height="13" rx="1" /> },
]

export function BootScreen({ leaving = false }: { leaving?: boolean }) {
  const t = useMessages(messages)
  const [line, setLine] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setLine((n) => (n + 1) % LINES.length), TURN_MS)
    return () => clearInterval(id)
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
