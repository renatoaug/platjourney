/** The guide and the trophies of a game: side by side on a wide screen, the guide first; on a phone,
 * one at a time behind a "Guia | Troféus" switch, so the list is a tap away instead of below the
 * whole guide. */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { useSlide } from '../ui/use-slide'
import './game-columns.css'

const messages = defineMessages({
  [Language.PtBR]: { label: 'Mostrar', trophies: 'Troféus', guide: 'Guia' },
  [Language.En]: { label: 'Show', trophies: 'Trophies', guide: 'Guide' },
})

type Side = 'trophies' | 'guide'
// The last choice holds while the app is open, across games.
let remembered: Side = 'guide'

export function GameColumns({
  trophies,
  guide,
  style,
  id,
}: {
  trophies: ReactNode
  guide: ReactNode
  style?: React.CSSProperties
  id?: string
}) {
  const t = useMessages(messages)
  const columns = useRef<HTMLDivElement>(null)
  const [side, setSideState] = useState<Side>(remembered)
  const switchRef = useSlide<HTMLDivElement>(side)
  const setSide = useCallback((s: Side) => {
    remembered = s
    setSideState(s)
  }, [])
  useEffect(() => {
    const select = (event: Event) => {
      const target = document.getElementById((event as CustomEvent<string>).detail)
      const children = columns.current?.querySelector('.game-columns')?.children
      if (!target || !children) return
      if (children[0]?.contains(target)) setSide('guide')
      else if (children[1]?.contains(target)) setSide('trophies')
    }
    window.addEventListener('game-section', select)
    return () => window.removeEventListener('game-section', select)
  }, [setSide])
  return (
    <div ref={columns} className="game-columns-wrap" id={id} data-side={side} style={style}>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the segmented control */}
      <div className="segmented game-switch" role="group" aria-label={t('label')} ref={switchRef}>
        {(['guide', 'trophies'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)}>
            {t(s)}
          </button>
        ))}
      </div>
      <div className="grid cols-2 game-columns">
        {guide}
        {trophies}
      </div>
    </div>
  )
}
