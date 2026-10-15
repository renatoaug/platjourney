/** The bookmark over a game card's cover: saves the game to the interests, or takes it out. None in
 * the demo, which only reads. */
import { type MouseEvent, useState } from 'react'
import { useInterests } from '../app/use-interests'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import type { Game, InterestSource } from '../lib/types'
import { Icon } from '../ui/icon'
import { useDemo } from './demo'
import './save-to-interests.css'

const messages = defineMessages({
  [Language.PtBR]: {
    saveAria: 'Salvar {name} nos interesses',
    removeAria: 'Remover {name} dos interesses',
    saveTip: 'Salvar nos interesses',
    removeTip: 'Remover dos interesses',
  },
  [Language.En]: {
    saveAria: 'Save {name} to interests',
    removeAria: 'Remove {name} from interests',
    saveTip: 'Save to interests',
    removeTip: 'Remove from interests',
  },
})

export function SaveToInterests({
  game,
  source,
}: {
  game: Pick<Game, 'id' | 'name'>
  /** Where the save came from, for the interest's record. */
  source: InterestSource
}) {
  const t = useMessages(messages)
  const { find, toggle } = useInterests()
  const demo = useDemo()
  const [saving, setSaving] = useState(false)
  if (demo) return null
  const saved = !!find(game.id)
  const name = game.name
  return (
    <button
      type="button"
      className={`card-save${saved ? ' saved' : ''}`}
      disabled={saving}
      aria-label={t(saved ? 'removeAria' : 'saveAria', { name })}
      data-tip={t(saved ? 'removeTip' : 'saveTip')}
      onClick={async (e: MouseEvent) => {
        // It sits over the card's links; the click saves, it does not open the game.
        e.preventDefault()
        e.stopPropagation()
        setSaving(true)
        await toggle(game.id, name, source)
        setSaving(false)
      }}
    >
      <Icon name={saved ? 'bookmark-filled' : 'bookmark'} />
    </button>
  )
}
