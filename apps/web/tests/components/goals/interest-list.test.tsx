import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { sampleGoals } from '../../../src/components/goals/fixtures'
import { InterestList, InterestListSkeleton } from '../../../src/components/goals/interest-list'
import type { GoalFilter } from '../../../src/components/goals/season'
import type { Interest } from '../../../src/lib/types'

function Demo({
  interests = sampleGoals.interests,
  filter: startFilter = 'all',
  busy,
  onRemove = () => {},
  onReorder = async () => {},
}: {
  interests?: Interest[]
  filter?: GoalFilter
  busy?: boolean
  onRemove?: (id: string) => void
  onReorder?: (ids: string[]) => Promise<unknown>
}) {
  const [filter, setFilter] = useState<GoalFilter>(startFilter)
  const [page, setPage] = useState(1)
  return (
    <MemoryRouter>
      <InterestList
        interests={interests}
        filter={filter}
        page={page}
        onFilter={(next) => {
          setFilter(next)
          setPage(1)
        }}
        onPage={setPage}
        busy={busy}
        newGameId={interests[0]?.game.id}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    </MemoryRouter>
  )
}

const names = () => screen.getAllByRole('link').map((a) => a.textContent)
const chip = (name: RegExp) => screen.getByRole('button', { name })

describe('InterestList', () => {
  test('shows ten per page with the progress of each game', () => {
    render(<Demo />)
    expect(chip(/^Todos/).textContent).toBe('Todos13')
    expect(chip(/^Em andamento/).textContent).toBe('Em andamento8')
    expect(chip(/^Não começados/).textContent).toBe('Não começados4')
    expect(chip(/^Platinados/).textContent).toBe('Platinados1')
    expect(names()).toHaveLength(10)
    expect(screen.getAllByText('não começou')[0]).toBeTruthy()
    expect(screen.getByText('17% · 7,5h')).toBeTruthy()
    expect(document.querySelector('li[data-id="interest:0"]')?.className).toContain('is-new')
  })

  test('pages to the rest, platinumed last', () => {
    render(<Demo />)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(names()).toEqual(['Hollow Knight', 'Sekiro', 'DAYS GONE'])
    expect(screen.getByText('platinado · 61h')).toBeTruthy()
  })

  test('the filters narrow the list; an empty filter says so', () => {
    render(<Demo />)
    fireEvent.click(chip(/^Platinados/))
    expect(names()).toEqual(['DAYS GONE'])
    fireEvent.click(chip(/^Não começados/))
    expect(names()).toEqual([
      'Ghost of Tsushima',
      'Ratchet & Clank: Rift Apart',
      'God of War Ragnarök',
      'Celeste',
    ])
    render(<Demo interests={sampleGoals.interests.filter((g) => !g.done)} filter="done" />)
    expect(screen.getByText('Nada por aqui com esse filtro.')).toBeTruthy()
  })

  test('remove asks for that interest', () => {
    const onRemove = mock()
    render(<Demo onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover Astro Bot dos interesses' }))
    expect(onRemove).toHaveBeenCalledWith('interest:1')
  })

  test('dragging a row by its grip moves it and saves the full order', async () => {
    let saved: () => void = () => {}
    const onReorder = mock(
      (_ids: string[]) =>
        new Promise<void>((resolve) => {
          saved = resolve
        }),
    )
    const { container } = render(<Demo onReorder={onReorder} />)
    const first = container.querySelector('li[data-id="interest:0"]') as HTMLElement
    const grip = within(first).getByText('', { selector: '[data-grip]' })
    fireEvent.pointerDown(grip, { clientY: 5 })
    expect(document.body.classList.contains('is-dragging')).toBe(true)
    expect(document.querySelector('.drag-ghost')).toBeTruthy()
    // A second grab while dragging is ignored.
    fireEvent.pointerDown(grip, { clientY: 5 })
    act(() => {
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: 400 }))
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: 400 }))
    })
    act(() => {
      document.dispatchEvent(new PointerEvent('pointerup'))
    })
    expect(document.body.classList.contains('is-dragging')).toBe(false)
    const [ids] = onReorder.mock.calls[0]
    // Only the visible page moved; the two open interests on page 2 keep their slots.
    expect(ids.slice(8)).toEqual(['interest:9', 'interest:0', 'interest:10', 'interest:11'])
    expect(ids).toHaveLength(12)
    expect(names()[0]).toBe('Astro Bot')
    await act(async () => saved())
    // The ghost glides into its slot, then goes.
    await act(() => new Promise((r) => setTimeout(r, 300)))
    expect(document.querySelector('.drag-ghost')).toBeNull()
  })

  test('a busy list cannot be dragged and pointer downs outside the grip do nothing', () => {
    const onReorder = mock(async () => {})
    const { container } = render(<Demo busy onReorder={onReorder} />)
    const first = container.querySelector('li[data-id="interest:0"]') as HTMLElement
    fireEvent.pointerDown(first.querySelector('[data-grip]') as HTMLElement)
    fireEvent.pointerDown(first.querySelector('a') as HTMLElement)
    expect(document.querySelector('.drag-ghost')).toBeNull()
  })

  test('the skeleton shows placeholder rows', () => {
    const { container } = render(<InterestListSkeleton />)
    expect(container.querySelectorAll('li')).toHaveLength(6)
  })
})

test('a game Nexo recommended says so, with the date', () => {
  const [first, ...rest] = sampleGoals.interests
  render(<Demo interests={[{ ...first, recommendedAt: '2026-10-13T14:00:00Z' }, ...rest]} />)
  expect(screen.getAllByText(/Recomendado pelo Nexo em/)).toHaveLength(1)
})

test('the game Nexo picked as the next platinum says so', () => {
  const [first, ...rest] = sampleGoals.interests
  const open = sampleGoals.interests.find((g) => !g.done) ?? first
  render(
    <Demo
      interests={[
        { ...open, nextPickAt: '2026-10-13T14:00:00Z' },
        ...rest.filter((g) => g !== open),
      ]}
    />,
  )
  expect(screen.getAllByText(/Próxima platina, escolhida pelo Nexo em/)).toHaveLength(1)
})

test('a saved game on sale shows the discount, the price and when it ends', () => {
  const [first, ...rest] = sampleGoals.interests
  const open = sampleGoals.interests.find((g) => !g.done) ?? first
  const deal = {
    price: 7485,
    base: 24950,
    discount: 70,
    endsAt: '2026-10-20T12:00:00Z',
    plus: false,
    currency: 'BRL',
    storeUrl: null,
  }
  render(<Demo interests={[{ ...open, deal }, ...rest.filter((g) => g !== open)]} />)
  expect(screen.getByText(/70% off · R\$\s?74,85 até 20 de out/)).toBeTruthy()
})

test('a game saved from the release calendar says so, with the day it was saved', () => {
  const interests = [
    {
      ...sampleGoals.interests.filter((g) => !g.done)[0],
      source: 'releases' as const,
      savedAt: '2026-10-14T12:00:00Z',
      recommendedAt: null,
    },
  ]
  render(
    <MemoryRouter>
      <InterestList
        interests={interests}
        filter="all"
        page={1}
        onFilter={() => {}}
        onPage={() => {}}
        busy={false}
        onRemove={() => {}}
        onReorder={async () => {}}
      />
    </MemoryRouter>,
  )
  expect(screen.getByText(/Salvo dos lançamentos em/)).toBeTruthy()
})
