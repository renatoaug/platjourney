/** A setting's name with an ⓘ beside it that unfolds what the setting does, so the list stays one
 * line per setting. Goes where a setting row puts its text (`.setting-text`). */
import { type MouseEvent, type ReactNode, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from './icon'
import './setting-title.css'

const messages = defineMessages({
  [Language.PtBR]: { about: 'O que é: {name}' },
  [Language.En]: { about: 'What it is: {name}' },
})

export function SettingTitle({
  title,
  hint,
  note,
  action,
  htmlFor,
}: {
  title: string
  /** The control the name labels, when the row itself is not a <label> (it holds other buttons). */
  htmlFor?: string
  /** A small action beside the name, like sending a test. */
  action?: ReactNode
  /** What the setting does, behind the ⓘ. */
  hint?: string | null
  /** Something the player needs to know now (blocked, link first): always shown. */
  note?: string | null
}) {
  const t = useMessages(messages)
  const [open, setOpen] = useState(false)
  // Inside a <label>, the click must not also flip the setting's switch.
  const toggle = (e: MouseEvent) => {
    e.preventDefault()
    setOpen((o) => !o)
  }
  return (
    <span className="setting-text">
      <span className="setting-title">
        {htmlFor ? (
          <label htmlFor={htmlFor}>
            <b>{title}</b>
          </label>
        ) : (
          <b>{title}</b>
        )}
        {hint && (
          <button
            type="button"
            className="setting-info"
            aria-expanded={open}
            aria-label={t('about', { name: title })}
            onClick={toggle}
          >
            <Icon name="info" />
          </button>
        )}
        {action}
      </span>
      {hint && open && <small className="setting-hint">{hint}</small>}
      {note && <small className="setting-note">{note}</small>}
    </span>
  )
}
