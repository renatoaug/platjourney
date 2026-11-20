import { expect, mock, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { type DeskTab, GameDesk } from '../../src/components/game-desk'
import { current } from '../../src/fixtures'
import type { CurrentGame } from '../../src/lib/types'
import { renderApp } from '../support/web'

const missables = Array.from({ length: 7 }, (_, i) => ({
  trophy: `Perdível ${i + 1}`,
  when: i === 0 ? 'Antes do **capítulo 2**' : '',
  how: '',
}))

function desk(
  game: CurrentGame = current,
  {
    tab = 'trophies',
    onTab = () => {},
    catalog,
    wide,
    visitor = false,
  }: {
    tab?: DeskTab
    onTab?: (tab: DeskTab) => void
    catalog?: boolean
    wide?: boolean
    visitor?: boolean
  } = {},
) {
  return renderApp(
    <GameDesk
      game={game}
      trophies={game.trophies}
      progress={game.progress}
      np={game.np}
      tab={tab}
      onTab={onTab}
      catalog={catalog ? <button type="button">Salvar</button> : undefined}
      page={<section>conteúdo da aba</section>}
      wide={wide}
    />,
    { value: { me: { ...SAMPLE_ME, visitor } } },
  )
}

const tabs = () =>
  [...document.querySelectorAll('.game-desk-tab')].map((b) => b.textContent?.trim())

test('an owned game: the name, its numbers, the tabs with the journey first and the summary beside', () => {
  const onTab = mock()
  desk({ ...current, guide: current.guide && { ...current.guide, missables } }, { onTab })
  expect(screen.getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(screen.getByText('conteúdo da aba')).toBeTruthy()
  expect(tabs()).toEqual(['Jornada', 'Guia', 'Troféus', 'Sessão', 'Sobre'])
  expect(screen.getByRole('button', { name: 'Troféus' }).getAttribute('aria-pressed')).toBe('true')
  expect(document.querySelector('.game-desk-strip.is-facts')).toBeTruthy()
  expect(document.querySelector('.game-desk-strip.is-tiers')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    String(current.progress),
  )
  // The missables: the first five and the way to the rest in the guide.
  expect(document.querySelectorAll('.game-desk-missables li')).toHaveLength(5)
  fireEvent.click(screen.getByRole('button', { name: /\+2 no guia/ }))
  expect(onTab).toHaveBeenLastCalledWith('guide')
  fireEvent.click(screen.getByRole('button', { name: /Seguir a jornada/ }))
  expect(onTab).toHaveBeenLastCalledWith('journey')
  fireEvent.click(screen.getByRole('button', { name: 'Sobre' }))
  expect(onTab).toHaveBeenLastCalledWith('about')
  expect(screen.getByRole('link', { name: 'Abrir conversa' })).toBeTruthy()
})

test('on the journey the way to it is not offered again, and a wide page drops the summary', () => {
  const { unmount } = desk(current, { tab: 'journey' })
  expect(screen.queryByRole('button', { name: /Seguir a jornada/ })).toBeNull()
  unmount()
  desk(current, { tab: 'journey', wide: true })
  expect(document.querySelector('.game-desk-rail')).toBeNull()
  expect(document.querySelector('.game-desk-body.is-wide')).toBeTruthy()
})

test('a catalog game: the trophy count, its actions and no session or progress', () => {
  desk(current, { catalog: true })
  expect(tabs()).not.toContain('Sessão')
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(document.querySelector('.game-desk-meta small')?.textContent).toContain('troféus')
})

test('with the platinum in, the summary says so and there is no session to plan', () => {
  desk({ ...current, trophies: current.trophies.map((t) => ({ ...t, earned: true })) })
  expect(screen.getByText('Platina conquistada')).toBeTruthy()
  expect(tabs()).not.toContain('Sessão')
  expect(screen.queryByRole('button', { name: /Seguir a jornada/ })).toBeNull()
})

test('a game without a guide shows no guide numbers and no missables', () => {
  desk({ ...current, guide: null })
  expect(document.querySelector('.game-desk-strip.is-facts')).toBeNull()
  expect(document.querySelector('.game-desk-missables')).toBeNull()
})

test('a visitor sees the journey tab locked', () => {
  desk(current, { visitor: true })
  const journey = screen.getByRole('button', { name: 'Jornada' }) as HTMLButtonElement
  expect(journey.disabled).toBe(true)
  expect(journey.title).toBe('Entre na sua conta')
  expect(screen.queryByRole('button', { name: /Seguir a jornada/ })).toBeNull()
})
