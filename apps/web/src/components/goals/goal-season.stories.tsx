import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { YearGoals } from '../../lib/types'
import { sampleGoals } from './fixtures'
import { type Feedback, GoalSeason, GoalSeasonSkeleton } from './goal-season'

const meta: Meta = { title: 'Goals/GoalSeason' }
export default meta
type Story = StoryObj

function Demo({
  goals: initial = sampleGoals,
  editing: startEditing = false,
  feedback: startFeedback = { text: '' },
  fail = false,
}: {
  goals?: YearGoals
  editing?: boolean
  feedback?: Feedback
  fail?: boolean
}) {
  const [goals, setGoals] = useState(initial)
  const [editing, setEditing] = useState(startEditing)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(startFeedback)
  const onSet = async (target: number) => {
    setBusy(true)
    setFeedback({ text: 'Salvando…' })
    await new Promise((r) => setTimeout(r, 600))
    setBusy(false)
    if (fail) {
      setFeedback({ text: 'Não foi possível salvar. Tente novamente.', error: true })
      return false
    }
    setGoals((g) => ({ ...g, target }))
    setEditing(false)
    setFeedback({ text: 'Alterações salvas.' })
    return true
  }
  return (
    <GoalSeason
      goals={goals}
      editing={editing}
      onEditing={setEditing}
      busy={busy}
      feedback={feedback}
      onFeedback={setFeedback}
      onSet={onSet}
    />
  )
}

export const Loaded: Story = { render: () => <Demo /> }

export const NoTarget: Story = { render: () => <Demo goals={{ ...sampleGoals, target: 0 }} /> }

export const Editing: Story = { render: () => <Demo editing /> }

export const SaveFails: Story = {
  render: () => (
    <Demo
      editing
      fail
      feedback={{ text: 'Não foi possível salvar. Tente novamente.', error: true }}
    />
  ),
}

export const Loading: Story = { render: () => <GoalSeasonSkeleton /> }

export const GoalReached: Story = {
  render: () => <Demo goals={{ ...sampleGoals, done: sampleGoals.target + 2 }} />,
}
