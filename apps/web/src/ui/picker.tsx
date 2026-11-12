/** A choice among a few options, drawn by the app so it opens the same everywhere: a button with
 * the current value and a chevron; a tap opens the options, as a sheet from the bottom on a phone
 * and a list under the button on a wide screen. Keyboard: arrows move, Enter picks, Esc closes. */
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icon'
import './picker.css'

export interface PickerOption<T extends string> {
  value: T
  label: string
  /** Drawn before the label, in the button and in the list (a color's dot). */
  lead?: ReactNode
}

export function Picker<T extends string>({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id?: string
  /** What is being chosen, read by screen readers and shown over the sheet. */
  label: string
  value: T
  options: PickerOption<T>[]
  disabled?: boolean
  onChange: (value: T) => void
}) {
  const auto = useId()
  const listId = `${id ?? auto}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  const close = useCallback((focus = true) => {
    setOpen(false)
    if (focus) button.current?.focus()
  }, [])
  const pick = (next: T) => {
    close()
    if (next !== value) onChange(next)
  }
  const show = () => {
    const r = button.current?.getBoundingClientRect()
    if (r) setPlace({ top: r.bottom + 6, right: window.innerWidth - r.right })
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    )
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    const outside = (e: PointerEvent) => {
      const target = e.target as Node
      if (!list.current?.contains(target) && !button.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, close])

  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return close()
    if (e.key === 'ArrowDown') setActive((a) => Math.min(options.length - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Enter' || e.key === ' ') pick(options[active].value)
    else return
    e.preventDefault()
  }

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        className="picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ''}`}
        disabled={disabled}
        onClick={(e) => {
          // Inside a setting's <label>, the click must not reach anything else.
          e.preventDefault()
          if (open) close()
          else show()
        }}
      >
        {current?.lead && <span className="picker-lead">{current.lead}</span>}
        <span>{current?.label}</span>
        <Icon name="chevron-down" />
      </button>
      {open &&
        createPortal(
          <div className="picker-layer">
            <button
              type="button"
              className="picker-scrim"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => close()}
            />
            {/* biome-ignore lint/a11y/useSemanticElements: a <select> opens the browser's own list, which is what this replaces */}
            <div
              ref={list}
              id={listId}
              className="picker-list"
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              tabIndex={-1}
              onKeyDown={keys}
              style={place ? { top: place.top, right: place.right } : undefined}
            >
              <div className="picker-title" aria-hidden="true">
                {label}
              </div>
              {options.map((o, i) => (
                <div
                  key={o.value}
                  tabIndex={-1}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  className={`picker-option${i === active ? ' is-active' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  onKeyDown={() => {}}
                >
                  {o.lead && <span className="picker-lead">{o.lead}</span>}
                  <span>{o.label}</span>
                  {o.value === value && <Icon name="check" />}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
