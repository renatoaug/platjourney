import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Guide, type GuideGame, GuideSkeleton } from '../../src/components/guide'
import { current } from '../../src/fixtures'
import type { GuideDetail } from '../../src/lib/types'

const guide = current.guide as GuideDetail
const game: GuideGame = {
  name: current.name,
  guide,
  trophies: current.trophies as unknown as GuideGame['trophies'],
  deepGuide: {
    chunks: 184,
    sources: [
      { source: 'Trophy Guides', url: 'https://guides.example.com' },
      { source: 'Platinum Forum', url: 'https://forum.example.com' },
    ],
    indexing: false,
    indexedAt: '2026-09-20T12:00:00Z',
  },
}

const show = (g: GuideGame | null) =>
  render(
    <MemoryRouter>
      <Guide game={g} />
    </MemoryRouter>,
  )

const tab = (name: RegExp) => screen.getByRole('tab', { name })
const panel = () => screen.getByRole('tabpanel')

describe('Guide', () => {
  test('opens on the summary with the quick facts, notes, tips and sources', () => {
    show(game)
    expect(tab(/Resumo/).getAttribute('aria-selected')).toBe('true')
    const summary = panel()
    expect(within(summary).getByText('3/10')).toBeTruthy()
    expect(within(summary).getByText('~70h')).toBeTruthy()
    expect(within(summary).getByText('Antes de começar')).toBeTruthy()
    expect(within(summary).getByText('Ponto sem retorno')).toBeTruthy()
    expect(within(summary).getByText('Dicas para o começo')).toBeTruthy()
    expect(within(summary).getByText(/Fontes: Trophy Guides, Platinum Forum/)).toBeTruthy()
    expect(within(summary).getByText('Dá para continuar')).toBeTruthy()
    expect(screen.getByText(/Pergunte detalhes ao Nexo/).textContent).toMatch(/atualizado em/)
    expect(screen.queryByText(/trechos de/)).toBeNull()
    expect(screen.getByRole('link', { name: /Perguntar/ }).getAttribute('href')).toBe('/nexo')
  })

  test('shows the counts on the tabs, zero included', () => {
    show(game)
    expect(tab(/Perdíveis/).textContent).toBe('Perdíveis0')
    expect(tab(/Roadmap/).textContent).toBe('Roadmap4')
    expect(tab(/Glossário/).textContent).toBe('Glossário8')
  })

  test('the key trophies tab shows highlights, tricks, the offline note and bugs', () => {
    show(game)
    fireEvent.click(tab(/Troféus-chave/))
    const key = panel()
    expect(within(key).getByLabelText('3 destaques')).toBeTruthy()
    expect(within(key).getByText('Mais fácil')).toBeTruthy()
    expect(within(key).getByText('79,6% de quem joga conquistou')).toBeTruthy()
    expect(within(key).getAllByText('Conquistado').length).toBeGreaterThan(0)
    expect(within(key).getByLabelText('6 dicas')).toBeTruthy()
    expect(within(key).getAllByText(/Fonte: Trophy Guides/).length).toBeGreaterThan(0)
    expect(within(key).getByText('Pode seguir offline')).toBeTruthy()
    expect(within(key).getByText('Sem troféus online indicados neste guia.')).toBeTruthy()
    expect(within(key).getByLabelText('2 troféus com bugs')).toBeTruthy()
    expect(within(key).getAllByText('Relato antigo, pode ter sido corrigido')).toHaveLength(2)
    expect(within(key).getAllByText('Como resolver ou evitar')).toHaveLength(2)
  })

  test('a trick for an earned trophy shows when it was earned', () => {
    show({
      ...game,
      guide: { ...guide, tricks: [{ trophy: 'De raspão', trick: 'Siga a história.' }] },
    })
    fireEvent.click(tab(/Troféus-chave/))
    expect(screen.getByText(/Conquistado em/)).toBeTruthy()
  })

  test('without tricks or highlights, with unknown bug status and online required', () => {
    show({
      ...game,
      trophies: null,
      guide: {
        ...guide,
        tricks: undefined,
        buggy: [
          { trophy: 'X', issue: 'Trava.', status: 'mystery' },
          { trophy: 'X', issue: 'Trava de novo.', reported: 'em 2024' },
          { trophy: 'Y', issue: 'Some.' },
        ],
        easiest: null,
        hardest: null,
        mostTedious: null,
        hasOnline: true,
      },
    })
    fireEvent.click(tab(/Troféus-chave/))
    expect(screen.getByText('Nenhum macete registrado')).toBeTruthy()
    expect(screen.queryByText('Destaques da platina')).toBeNull()
    expect(screen.getByText('Atenção ao modo online')).toBeTruthy()
    expect(screen.getByText(/ainda não detalha os troféus/)).toBeTruthy()
    expect(screen.getByLabelText('2 troféus com bugs')).toBeTruthy()
    expect(screen.getByText('mystery')).toBeTruthy()
    expect(screen.getByText('em 2024')).toBeTruthy()
  })

  test('missables, online trophies and a guide without the optional notes', () => {
    show({
      ...game,
      deepGuide: { chunks: 0, sources: [], indexing: true },
      guide: {
        ...guide,
        hasMissables: true,
        hasOnline: true,
        missables: [
          { trophy: 'Entrega especial', when: 'Capítulo 2', how: 'Entregue antes de sair.' },
        ],
        onlineTrophies: [
          { trophy: 'Juntos', what: 'Complete uma partida cooperativa.', boostable: true },
        ],
        difficultyTrophy: 'Termine no difícil. Sem trocar.',
        collectibles: null,
        pointOfNoReturn: null,
        autopop: null,
        postgame: null,
        earlyTips: [],
      },
    })
    expect(screen.getByText(/Indexando os guias completos/)).toBeTruthy()
    expect(screen.getByText('Troféu de dificuldade:')).toBeTruthy()
    expect(screen.getByText('1 troféu')).toBeTruthy()
    expect(screen.queryByText('Antes de começar')).toBeNull()
    expect(screen.queryByText('Dicas para o começo')).toBeNull()
    fireEvent.click(tab(/Perdíveis/))
    expect(within(panel()).getByText('Entrega especial')).toBeTruthy()
    expect(within(panel()).getByText('Entregue antes de sair.')).toBeTruthy()
    fireEvent.click(tab(/Troféus-chave/))
    expect(screen.getByText('1 troféu online')).toBeTruthy()
    expect(screen.getByText('Dá para combinar com outras pessoas')).toBeTruthy()
  })

  test('two online trophies and an empty missables tab', () => {
    show({
      ...game,
      deepGuide: null,
      guide: {
        ...guide,
        onlineTrophies: [
          { trophy: 'A', what: 'a', boostable: false },
          { trophy: 'B', what: 'b', boostable: false },
        ],
      },
    })
    expect(screen.getByText('2 troféus')).toBeTruthy()
    fireEvent.click(tab(/Perdíveis/))
    expect(screen.getByText(/Nenhum troféu perdível neste jogo/)).toBeTruthy()
    fireEvent.click(tab(/Troféus-chave/))
    expect(screen.getByText('2 troféus online')).toBeTruthy()
  })

  test('the roadmap lists each phase with its trophies', () => {
    show(game)
    fireEvent.click(tab(/Roadmap/))
    expect(within(panel()).getByText(/1\. Fase 1/)).toBeTruthy()
    expect(within(panel()).getByText(/Uma já foi · Me dê ouvidos/)).toBeTruthy()
  })

  test('the glossary filters by term or meaning, ignoring accents', () => {
    show(game)
    fireEvent.click(tab(/Glossário/))
    const search = screen.getByRole('searchbox', { name: 'Buscar termo no glossário' })
    fireEvent.change(search, { target: { value: 'confianca aliado' } })
    expect(screen.getByText('Confiança Aliado').closest('div')?.hidden).toBe(false)
    expect(screen.getByText('Horda').closest('div')?.hidden).toBe(true)
    fireEvent.change(search, { target: { value: 'zzzz' } })
    const status = screen.getByRole('status')
    expect(status.hidden).toBe(false)
    expect(status.textContent).toBe('Nenhum termo encontrado. Tente outra palavra.')
  })

  test('an empty glossary says so', () => {
    show({ ...game, guide: { ...guide, glossary: [] } })
    fireEvent.click(tab(/Glossário/))
    expect(screen.getByText('Este guia ainda não tem termos no glossário.')).toBeTruthy()
  })

  test('arrow keys, Home and End move between tabs', () => {
    show(game)
    fireEvent.keyDown(tab(/Resumo/), { key: 'ArrowLeft' })
    expect(tab(/Glossário/).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tab(/Glossário/), { key: 'ArrowRight' })
    expect(tab(/Resumo/).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tab(/Resumo/), { key: 'End' })
    expect(tab(/Glossário/).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tab(/Glossário/), { key: 'Home' })
    expect(tab(/Resumo/).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(tab(/Resumo/), { key: 'a' })
    expect(tab(/Resumo/).getAttribute('aria-selected')).toBe('true')
  })

  test('a queued guide says it is being prepared', () => {
    show({ name: 'Novo jogo', guide: null, queued: true })
    expect(screen.getByText(/está em preparação/)).toBeTruthy()
  })

  test('a guide being built shows the skeleton and a pending line', () => {
    show({ name: 'Novo jogo', guide: null })
    expect(screen.getByText(/Montando o guia/)).toBeTruthy()
    const first = screen.getByRole('button', { name: 'Resumo' }) as HTMLButtonElement
    expect(first.disabled).toBe(true)
  })

  test('the skeleton alone has the heading and disabled tabs', () => {
    render(<GuideSkeleton />)
    expect(screen.getByRole('heading', { name: 'Guia da platina' })).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })
})
