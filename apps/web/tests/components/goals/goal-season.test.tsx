import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { sampleGoals } from '../../../src/components/goals/fixtures'
import {
  type Feedback,
  GoalSeason,
  GoalSeasonSkeleton,
} from '../../../src/components/goals/goal-season'
import { season } from '../../../src/components/goals/season'
import type { YearGoals } from '../../../src/lib/types'

// Like the story: the card owns its editing and feedback, saving goes through onSet.
function Demo({
  goals: initial = sampleGoals,
  editing: startEditing = false,
  onSet,
}: {
  goals?: YearGoals
  editing?: boolean
  onSet: (target: number) => Promise<boolean>
}) {
  const [goals, setGoals] = useState(initial)
  const [editing, setEditing] = useState(startEditing)
  const [feedback, setFeedback] = useState<Feedback>({ text: '' })
  return (
    <GoalSeason
      goals={goals}
      editing={editing}
      onEditing={setEditing}
      feedback={feedback}
      onFeedback={setFeedback}
      onSet={async (target) => {
        const ok = await onSet(target)
        if (ok) {
          setGoals((g) => ({ ...g, target }))
          setEditing(false)
          setFeedback({ text: 'Alterações salvas.' })
        } else setFeedback({ text: 'Não foi possível salvar. Tente novamente.', error: true })
        return ok
      }}
    />
  )
}

const target = () => screen.getByLabelText('Meta anual de platinas') as HTMLInputElement

describe('GoalSeason', () => {
  test('shows the platinums against the target and the pace', () => {
    render(<Demo onSet={async () => true} />)
    expect(screen.getByText('TEMPORADA 2026')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('58')
    expect(screen.getByText(/Faltam 5 em/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Editar meta/ })).toBeTruthy()
  })

  test('without a target it invites to set one', () => {
    render(<Demo goals={{ ...sampleGoals, target: 0 }} onSet={async () => true} />)
    expect(screen.getByText('Escolha um objetivo que combine com o seu ritmo.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Definir meta/ })).toBeTruthy()
  })

  test('a reached target celebrates', () => {
    render(<Demo goals={{ ...sampleGoals, target: 7 }} onSet={async () => true} />)
    expect(screen.getByText('Meta conquistada. Que venha o próximo desafio.')).toBeTruthy()
  })

  test('edits the target with the stepper and saves it', async () => {
    const onSet = mock(async () => true)
    render(<Demo onSet={onSet} />)
    fireEvent.click(screen.getByRole('button', { name: /Editar meta/ }))
    await waitFor(() => expect(document.activeElement).toBe(target()))
    expect(target().value).toBe('12')
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar meta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar meta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir meta' }))
    expect(target().value).toBe('13')
    fireEvent.click(screen.getByRole('button', { name: /Salvar meta/ }))
    expect(await screen.findByText('Alterações salvas.')).toBeTruthy()
    expect(onSet).toHaveBeenCalledWith(13)
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Editar meta/ })),
    )
  })

  test('a failed save keeps the editor open and says so', async () => {
    render(<Demo editing onSet={async () => false} />)
    fireEvent.click(screen.getByRole('button', { name: /Salvar meta/ }))
    expect(await screen.findByText('Não foi possível salvar. Tente novamente.')).toBeTruthy()
    expect(target()).toBeTruthy()
  })

  test('an invalid target is not sent, and the stepper recovers from it', () => {
    const onSet = mock(async () => true)
    render(<Demo editing onSet={onSet} />)
    fireEvent.change(target(), { target: { value: '0' } })
    expect(
      (screen.getByRole('button', { name: 'Diminuir meta' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Salvar meta/ }))
    expect(onSet).not.toHaveBeenCalled()
    fireEvent.change(target(), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar meta' }))
    expect(target().value).toBe('1')
  })

  test('cancel closes the editor', () => {
    render(<Demo editing onSet={async () => true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Meta anual de platinas')).toBeNull()
  })

  test('the skeleton renders', () => {
    const { container } = render(<GoalSeasonSkeleton />)
    expect(container.querySelector('.goal-season')).toBeTruthy()
  })
})

describe('season', () => {
  test('the last month speaks in the singular', () => {
    expect(season({ ...sampleGoals, done: 10 }, new Date(2026, 11, 1)).pace).toBe(
      'Faltam 2 em 1 mês · 2 platinas por mês.',
    )
  })
})
