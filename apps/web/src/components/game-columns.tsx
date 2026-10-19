/** The guide and the trophies of a game: side by side on a wide screen, the guide first; on a phone,
 * one at a time behind a "Guia | Troféus" switch, so the list is a tap away instead of below the
 * whole guide. */
import { type ReactNode, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
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
}: {
  trophies: ReactNode
  guide: ReactNode
  style?: React.CSSProperties
}) {
  const t = useMessages(messages)
  const [side, setSideState] = useState<Side>(remembered)
  const setSide = (s: Side) => {
    remembered = s
    setSideState(s)
  }
  return (
    <div className="game-columns-wrap" data-side={side} style={style}>
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the segmented control */}
      <div className="segmented game-switch" role="group" aria-label={t('label')}>
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
