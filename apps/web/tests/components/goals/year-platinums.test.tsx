import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MockAppState } from '../../../src/app/app-state'
import { emptyGoals, sampleGoals } from '../../../src/components/goals/fixtures'
import { YearPlatinums } from '../../../src/components/goals/year-platinums'
import type { YearGoals } from '../../../src/lib/types'

const show = (goals: YearGoals) =>
  render(
    <MemoryRouter>
      <MockAppState>
        <YearPlatinums goals={goals} />
      </MockAppState>
    </MemoryRouter>,
  )

const month = (name: RegExp) => screen.getByRole('button', { name })

describe('YearPlatinums', () => {
  test('lists the newest platinums first, six per page, with the year order', () => {
    show(sampleGoals)
    expect(screen.getByText('Mais recentes primeiro')).toBeTruthy()
    expect(screen.getByText('6 meses com conquistas')).toBeTruthy()
    expect(month(/^Ago: 2 platinas/)).toBeTruthy()
    expect(month(/^Set: 1 platina$/)).toBeTruthy()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6)
    expect(links[0].getAttribute('href')).toBe('/title/game/game%3Adays-gone')
    expect(within(links[0]).getByLabelText('Platina 7 do ano')).toBeTruthy()
    expect(screen.getByText('· 61h de jogo')).toBeTruthy()
  })

  test('pages to the oldest platinum', () => {
    show(sampleGoals)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].textContent).toContain('Inside')
    expect(within(links[0]).queryByText(/de jogo/)).toBeNull()
  })

  test('a month filters the timeline and toggles back to the whole year', () => {
    show(sampleGoals)
    fireEvent.click(month(/^Ago/))
    expect(month(/^Ago/).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Conquistas de Ago')).toBeTruthy()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Ver o ano todo' }))
    expect(screen.getByText('Mais recentes primeiro')).toBeTruthy()
    fireEvent.click(month(/^Mar/))
    expect(screen.getByText('Nenhuma platina registrada neste mês.')).toBeTruthy()
    fireEvent.click(month(/^Mar/))
    expect(screen.getAllByRole('link')).toHaveLength(6)
  })

  test('a year without platinums says the first one is coming', () => {
    show(emptyGoals)
    expect(screen.getByText(/Sua primeira platina do ano/)).toBeTruthy()
  })

  test("the year's pace: the average, the quickest and the longest of the timed platinums", () => {
    show(sampleGoals)
    const pace = within(screen.getByRole('region', { name: 'Ritmo do ano' }))
    expect(pace.getByText('em 6 platinas')).toBeTruthy()
    expect(pace.getByText("Astro's Playroom")).toBeTruthy()
    expect(pace.getByText('DAYS GONE')).toBeTruthy()
  })

  test('one timed platinum has nothing to compare', () => {
    show({ ...sampleGoals, platinumed: sampleGoals.platinumed.slice(0, 1) })
    expect(screen.queryByRole('region', { name: 'Ritmo do ano' })).toBeNull()
  })
})
