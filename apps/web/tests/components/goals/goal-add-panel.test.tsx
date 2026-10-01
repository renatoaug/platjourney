import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { sampleGoals } from '../../../src/components/goals/fixtures'
import { GoalAddPanel, searchCatalog } from '../../../src/components/goals/goal-add-panel'
import type { Game } from '../../../src/lib/types'

const elden: Game = {
  id: 'game:elden-ring',
  name: 'Elden Ring',
  platforms: ['PS5'],
  release_year: 2022,
}
const ghost = sampleGoals.interests[0].game
const bare: Game = { id: 'game:bare', name: 'Bare' }

// Like the story: the panel's draft and selection live in the parent.
function Demo({
  search,
  selection: initial = null,
  onSave = () => {},
  onClose = () => {},
  busy,
}: {
  search: (query: string) => Promise<Game[]>
  selection?: Game | null
  onSave?: (game: Game) => void
  onClose?: () => void
  busy?: boolean
}) {
  const [draft, setDraft] = useState(initial?.name ?? '')
  const [selection, setSelection] = useState<Game | null>(initial)
  const input = useRef<HTMLInputElement>(null)
  return (
    <GoalAddPanel
      open
      busy={busy}
      interests={sampleGoals.interests}
      draft={draft}
      onDraft={setDraft}
      selection={selection}
      onSelection={setSelection}
      onSave={onSave}
      onClose={onClose}
      inputRef={input}
      search={search}
    />
  )
}

const box = () => screen.getByRole('combobox') as HTMLInputElement
const status = () => screen.getByRole('status').textContent
// The search waits 250 ms after the last key.
const settle = () => act(() => new Promise((r) => setTimeout(r, 300)))
const typeQuery = async (value: string) => {
  fireEvent.change(box(), { target: { value } })
  await settle()
}

afterEach(() => mock.restore())

describe('GoalAddPanel', () => {
  test('one character asks for another', () => {
    render(<Demo search={async () => []} />)
    fireEvent.change(box(), { target: { value: 'e' } })
    expect(screen.getByText('Digite mais um caractere para buscar no catálogo.')).toBeTruthy()
    expect(box().getAttribute('aria-expanded')).toBe('true')
    fireEvent.change(box(), { target: { value: '' } })
    expect(box().getAttribute('aria-expanded')).toBe('false')
  })

  test('searches, picks with the keyboard and saves', async () => {
    const search = mock(async () => [elden, ghost, bare])
    const onSave = mock()
    render(<Demo search={search} onSave={onSave} />)
    fireEvent.change(box(), { target: { value: 'el' } })
    expect(status()).toBe('Buscando no catálogo…')
    expect(box().getAttribute('aria-busy')).toBe('true')
    // While searching, Enter does not submit.
    fireEvent.keyDown(box(), { key: 'Enter' })
    await settle()
    expect(search).toHaveBeenCalledWith('el')
    expect(status()).toBe('3 jogos encontrados.')
    expect(screen.getByText('Nos interesses')).toBeTruthy()
    expect(screen.getByRole('option', { name: /Elden Ring/ }).textContent).toContain('PS5 · 2022')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(box().getAttribute('aria-activedescendant')).toBe('goal-option-0')
    fireEvent.keyDown(box(), { key: 'Tab' })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(status()).toBe('Elden Ring escolhido. Salve para adicionar aos interesses.')
    expect(box().readOnly).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSave).toHaveBeenCalledWith(elden)
  })

  test('a game already saved cannot be picked; a click picks another', async () => {
    render(<Demo search={async () => [ghost, bare]} />)
    await typeQuery('gh')
    fireEvent.click(screen.getByRole('option', { name: /Ghost of Tsushima/ }))
    expect(box().readOnly).toBe(false)
    fireEvent.mouseDown(screen.getByRole('listbox'))
    fireEvent.click(screen.getByRole('option', { name: /Bare/ }))
    expect(box().value).toBe('Bare')
  })

  test('Enter with nothing highlighted does nothing', async () => {
    render(<Demo search={async () => [elden]} />)
    await typeQuery('elden')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(box().readOnly).toBe(false)
  })

  test('Backspace on the chosen game, or the clear button, goes back to typing', () => {
    render(<Demo search={async () => []} selection={elden} />)
    expect(screen.getByText('PS5 · 2022')).toBeTruthy()
    fireEvent.keyDown(box(), { key: 'Backspace' })
    expect(box().value).toBe('')
    expect(box().readOnly).toBe(false)
  })

  test('the clear button drops the chosen game', () => {
    render(<Demo search={async () => []} selection={bare} />)
    fireEvent.click(screen.getByRole('button', { name: 'Trocar o jogo escolhido' }))
    expect(box().value).toBe('')
  })

  test('nothing found says so', async () => {
    render(<Demo search={async () => []} />)
    await typeQuery('zz')
    expect(screen.getByText('Nenhum jogo encontrado')).toBeTruthy()
    expect(status()).toBe('Nenhum jogo encontrado no catálogo. Tente outro nome.')
  })

  test('a failed search offers to try again', async () => {
    let fail = true
    render(
      <Demo
        search={async () => {
          if (fail) throw new Error('offline')
          return [elden]
        }}
      />,
    )
    await typeQuery('elden')
    expect(status()).toBe('A busca está indisponível no momento.')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await settle()
    expect(screen.getByRole('option', { name: /Elden Ring/ })).toBeTruthy()
  })

  test('an answer to an older query is dropped', async () => {
    const answers: ((games: Game[]) => void)[] = []
    const fails: ((e: Error) => void)[] = []
    render(
      <Demo
        search={() =>
          new Promise<Game[]>((resolve, reject) => {
            answers.push(resolve)
            fails.push(reject)
          })
        }
      />,
    )
    await typeQuery('el')
    await typeQuery('eld')
    await act(async () => {
      answers[0]([bare])
      fails[0](new Error('late'))
    })
    expect(screen.queryByRole('option')).toBeNull()
    await act(async () => answers[1]([elden]))
    expect(screen.getByRole('option', { name: /Elden Ring/ })).toBeTruthy()
  })

  test('Escape stops the search, then closes the panel', async () => {
    const onClose = mock()
    render(<Demo search={async () => [elden]} onClose={onClose} />)
    fireEvent.change(box(), { target: { value: 'elden' } })
    fireEvent.keyDown(box(), { key: 'Escape' })
    await settle()
    expect(box().getAttribute('aria-expanded')).toBe('false')
    expect(onClose).toHaveBeenCalled()
  })

  test('the cancel button closes the panel', () => {
    const onClose = mock()
    render(<Demo search={async () => []} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar inclusão' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('the catalog search asks the server', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([elden])),
    )
    expect(await searchCatalog('elden ring')).toEqual([elden])
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/games/search?q=elden%20ring')
  })
})
