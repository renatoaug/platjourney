/** The list that opens over the message box while a command is typed: the commands for "/", the player's games for "/game". */
import { useEffect, useRef } from 'react'
import { Cover } from '../../ui/cover'

export interface MenuItem {
  key: string
  title: string
  detail?: string
  /** A game's icon; commands have none. */
  icon?: string | null
  badge?: string
}

export function CommandMenu({
  id,
  label,
  items,
  active,
  empty,
  onPick,
}: {
  id: string
  label: string
  items: MenuItem[]
  active: number
  /** Shown when the search finds nothing; without it, nothing shows. */
  empty?: string
  onPick: (index: number) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])
  if (!items.length && !empty) return null
  return (
    // Mousedown would blur the message box, which keeps the keys.
    <div
      ref={list}
      id={id}
      role="listbox"
      aria-label={label}
      className="chat-menu"
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length ? (
        items.map((item, i) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/useFocusableInteractive: picked from the message box with the arrows and Enter (aria-activedescendant); focus stays there
          <div
            key={item.key}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === active}
            onClick={() => onPick(i)}
          >
            {item.icon !== undefined && (
              <Cover url={item.icon} name={item.title} className="chat-menu-cover" />
            )}
            <span>
              <b>{item.title}</b>
              {item.detail ? <small>{item.detail}</small> : null}
            </span>
            {item.badge ? <small className="chat-menu-badge">{item.badge}</small> : null}
          </div>
        ))
      ) : (
        <p className="chat-menu-empty">{empty}</p>
      )}
    </div>
  )
}
