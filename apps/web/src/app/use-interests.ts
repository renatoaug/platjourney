/** The player's interests (games they want to platinum) from the app state, and saving or removing one from any screen. */
import { useCallback } from 'react'
import { defineMessages, Language, translator } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import type { YearGoals } from '../lib/types'
import { toast } from '../ui/toast'
import { useApp } from './app-state'

/** Also read by the goals screen, which saves interests through its own commands. */
export const messages = defineMessages({
  [Language.PtBR]: {
    interestRemoved: '{name} removido dos interesses',
    interestSaved: '{name} salvo nos interesses',
    interestSee: 'Ver',
    interestFailed: 'Não conseguimos salvar. Tenta de novo.',
  },
  [Language.En]: {
    interestRemoved: '{name} removed from interests',
    interestSaved: '{name} saved to interests',
    interestSee: 'View',
    interestFailed: 'Could not save. Try again.',
  },
})
const t = translator(messages)

export function useInterests() {
  const { data, setData } = useApp()
  const interests = data?.goals?.interests ?? []

  /** Every change to the goals goes through /api/goals, which answers with the whole new state. */
  const command = useCallback(
    async (text: string) => {
      const goals = await api<YearGoals>('/api/goals', { command: text })
      setData((d) => ({ ...d, goals }))
      return goals
    },
    [setData],
  )

  const find = useCallback(
    (gameId: string) => interests.find((i) => i.game.id === gameId),
    [interests],
  )

  /** Saves the game, or removes it when it is already there, with the success toast. */
  const toggle = useCallback(
    async (gameId: string, name: string) => {
      const existing = find(gameId)
      try {
        await command(existing ? `remove ${existing.id}` : `add ${gameId}`)
        if (existing) toast(t('interestRemoved', { name }), 'success')
        else
          toast(t('interestSaved', { name }), 'success', {
            href: '#/goals',
            label: t('interestSee'),
          })
      } catch (e) {
        if (!(e instanceof ApiError && e.handled)) toast(t('interestFailed'))
      }
    },
    [find, command],
  )

  return { interests, find, toggle, command }
}
