/** The guide and the trophies of a game: side by side on a wide screen, the guide first; on a phone,
 * one at a time behind a "Guia | Troféus" switch, so the list is a tap away instead of below the
 * whole guide. */
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
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
  tabs = false,
}: {
  trophies: ReactNode
  guide: ReactNode
  style?: React.CSSProperties
  id?: string
  /** A journey keeps one panel visible at every width, starting with personal trophies. */
  tabs?: boolean
}) {
  const t = useMessages(messages)
  const uid = useId()
  const columns = useRef<HTMLDivElement>(null)
  const [side, setSideState] = useState<Side>(tabs ? 'trophies' : remembered)
  const switchRef = useSlide<HTMLDivElement>(side)
  const setSide = useCallback(
    (s: Side) => {
      if (!tabs) remembered = s
      setSideState(s)
    },
    [tabs],
  )
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
  useEffect(() => {
    if (tabs) window.dispatchEvent(new CustomEvent('game-panel-change', { detail: side }))
  }, [tabs, side])
  const switchByKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!tabs) return
    const destinations: Record<string, Side> = {
      Home: 'trophies',
      End: 'guide',
      ArrowLeft: side === 'guide' ? 'trophies' : 'guide',
      ArrowRight: side === 'guide' ? 'trophies' : 'guide',
    }
    const next = destinations[event.key]
    if (!next) return
    event.preventDefault()
    setSide(next)
    document.getElementById(`${uid}-${next}-tab`)?.focus()
  }
  return (
    <div
      ref={columns}
      className={`game-columns-wrap${tabs ? ' game-columns-tabs' : ''}`}
      id={id}
      data-side={side}
      style={style}
    >
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: both conditional roles support aria-label */}
      <div
        className="segmented game-switch"
        role={tabs ? 'tablist' : 'group'}
        aria-label={t('label')}
        ref={switchRef}
      >
        {(tabs ? (['trophies', 'guide'] as const) : (['guide', 'trophies'] as const)).map((s) => (
          // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-selected is set only with role=tab
          <button
            key={s}
            type="button"
            id={`${uid}-${s}-tab`}
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? side === s : undefined}
            aria-pressed={tabs ? undefined : side === s}
            aria-controls={tabs ? `${uid}-${s}-panel` : undefined}
            tabIndex={tabs && side !== s ? -1 : 0}
            onKeyDown={switchByKey}
            onClick={() => setSide(s)}
          >
            {t(s)}
          </button>
        ))}
      </div>
      <div className={tabs ? 'game-columns' : 'grid cols-2 game-columns'}>
        {tabs ? (
          <div
            id={`${uid}-guide-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-guide-tab`}
            hidden={side !== 'guide'}
          >
            {guide}
          </div>
        ) : (
          guide
        )}
        {tabs ? (
          <div
            id={`${uid}-trophies-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-trophies-tab`}
            hidden={side !== 'trophies'}
          >
            {trophies}
          </div>
        ) : (
          trophies
        )}
      </div>
    </div>
  )
}
