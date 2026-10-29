import { afterEach, describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MockAppState } from '../../src/app/app-state'
import { TrophyList, TrophyListSkeleton } from '../../src/components/trophy-list'
import { current } from '../../src/fixtures'
import type { Trophy } from '../../src/lib/types'
import { ToastHost } from '../../src/ui/toast'

const base = current.trophies as unknown as Trophy[]

// The same set the stories use: base trophies, a second copy and a DLC copy with progress.
const many: Trophy[] = [
  ...base,
  ...base.map((t, i) => ({
    ...t,
    id: 100 + i,
    name: `${t.name} II`,
    earned: false,
    earnedAt: undefined,
  })),
  ...base.map((t, i) => ({
    ...t,
    id: 200 + i,
    groupId: '001',
    name: `${t.name} (DLC)`,
    earned: false,
    earnedAt: undefined,
    progressTarget: i % 2 ? 50 : null,
    progressValue: i % 2 ? 12 + i : null,
    progressRate: i % 2 ? 24 + i * 2 : null,
  })),
]

const catalog: Trophy[] = base.map(({ rarity, earnedRate, earnedAt, ...t }) => ({
  ...t,
  earned: false,
}))

const show = (trophies: Trophy[] | null, props: { np?: string; prefix?: string } = {}) =>
  render(
    <MemoryRouter>
      <MockAppState>
        <TrophyList trophies={trophies} {...props} />
        <ToastHost />
      </MockAppState>
    </MemoryRouter>,
  )

const results = () => screen.getByRole('status').textContent
const names = () => screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)

afterEach(() => {
  mock.restore()
})

describe('TrophyList', () => {
  test('null trophies show the skeleton with disabled controls', () => {
    show(null)
    expect((screen.getByLabelText('Buscar troféu') as HTMLInputElement).disabled).toBe(true)
    render(<TrophyListSkeleton rows={2} />)
  })

  test('an empty list waits for the PSN', () => {
    show([])
    expect(screen.getByText(/aparecem aqui assim que a PSN enviar a lista/)).toBeTruthy()
  })

  test('shows the base game, pending first, eight per page', () => {
    show(many)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Troféus 3/16')
    expect(results()).toBe('1–8 de 16 troféus · Jogo base')
    expect(names()[0]).not.toBe('De raspão')
    expect(screen.getAllByRole('article')).toHaveLength(8)
  })

  test('pages forward and back', () => {
    show(many)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(results()).toBe('9–16 de 16 troféus · Jogo base')
    expect(screen.getByRole('button', { name: 'Página 2' }).getAttribute('aria-current')).toBe(
      'page',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(results()).toBe('1–8 de 16 troféus · Jogo base')
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }))
    expect(results()).toBe('9–16 de 16 troféus · Jogo base')
  })

  test('many pages collapse into a gap', () => {
    const lots = Array.from({ length: 40 }, (_, i) => ({ ...base[4], id: 500 + i, name: `T${i}` }))
    show(lots)
    expect(screen.getByText('…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Página 5' })).toBeTruthy()
  })

  test('the status buttons filter earned and pending', () => {
    show(many)
    fireEvent.click(screen.getByRole('button', { name: 'Conquistados' }))
    expect(results()).toBe('1–3 de 3 troféus · Jogo base')
    expect(screen.getAllByText(/Conquistado ·/)).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Pendentes' }))
    expect(results()).toBe('1–8 de 13 troféus · Jogo base')
    expect(JSON.parse(localStorage.getItem('trophyFilters') ?? '{}').status).toBe('pending')
  })

  test('search matches name, detail or English name; nothing found says so', () => {
    show(many)
    const search = screen.getByLabelText('Buscar troféu')
    fireEvent.change(search, { target: { value: 'boozer' } })
    expect(results()).toBe('1–2 de 2 troféus · Jogo base')
    fireEvent.change(search, { target: { value: 'one percenter' } })
    expect(names()).toEqual(['Um por cento', 'Um por cento II'])
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(results()).toBe('Nenhum troféu encontrado')
    expect(screen.getByText(/Tente outro termo/)).toBeTruthy()
  })

  test('the content select shows DLC, all and progress only', () => {
    show(many)
    const group = screen.getByLabelText('Conteúdo')
    fireEvent.change(group, { target: { value: 'dlc' } })
    expect(results()).toBe('1–8 de 8 troféus · DLC')
    expect(screen.getByText(/Filtros/).textContent).toContain('Filtros 1')
    fireEvent.change(group, { target: { value: 'all' } })
    expect(results()).toBe('1–8 de 24 troféus · Jogo base + DLC')
    fireEvent.click(screen.getByLabelText('Só com progresso'))
    expect(results()).toBe('1–4 de 4 troféus · Jogo base + DLC')
    expect(screen.getByText('13/50 · 26%')).toBeTruthy()
  })

  test('each sort orders the list', () => {
    show(base)
    const sort = screen.getByLabelText('Ordenar por')
    fireEvent.change(sort, { target: { value: 'psn' } })
    expect(names()[0]).toBe('Um por cento')
    fireEvent.change(sort, { target: { value: 'rarity' } })
    expect(names()[0]).toBe('Um por cento')
    fireEvent.change(sort, { target: { value: 'common' } })
    expect(names()[0]).toBe('De raspão')
    fireEvent.change(sort, { target: { value: 'type' } })
    expect(names()[0]).toBe('Um por cento')
    fireEvent.change(sort, { target: { value: 'date' } })
    expect(names()[0]).toBe('De raspão')
    fireEvent.change(sort, { target: { value: 'progress' } })
    expect(names()[0]).toBe('Irmãos de armas')
    expect(JSON.parse(localStorage.getItem('trophyFilters') ?? '{}').sort).toBe('progress')
  })

  test('a platinumed game opens in the PSN order', () => {
    show(base.map((t) => ({ ...t, earned: true })))
    expect((screen.getByLabelText('Ordenar por') as HTMLSelectElement).value).toBe('psn')
  })

  test('saved filters come back, and a broken save is ignored', () => {
    localStorage.setItem(
      'trophyFilters',
      JSON.stringify({ sort: 'rarity', group: 'dlc', onlyProgress: true, hideEarned: true }),
    )
    const first = show(many)
    expect(results()).toBe('1–4 de 4 troféus · DLC')
    expect(screen.getByRole('button', { name: 'Pendentes' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    first.unmount()
    localStorage.setItem('trophyFilters', '{oops')
    show(many)
    expect(results()).toBe('1–8 de 16 troféus · Jogo base')
  })

  test('a catalog list counts trophies without the earned share', () => {
    show(catalog, { prefix: 'title-t' })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Troféus 8')
    expect(screen.queryByRole('link', { name: /Pedir dica/ })).toBeNull()
  })

  test('asking for a tip opens Nexo on the game with the trophy attached', () => {
    show(base, { np: 'NPWR1' })
    // Earned trophies have nothing to ask.
    expect(screen.queryByRole('link', { name: 'Pedir dica sobre Um por cento' })).toBeNull()
    const link = screen.getByRole('link', { name: 'Pedir dica sobre Irmãos de armas' })
    expect(link.getAttribute('href')).toBe('/nexo?game=NPWR1&trophy=Irm%C3%A3os+de+armas')
  })
})
