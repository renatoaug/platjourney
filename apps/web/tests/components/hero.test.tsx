import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Hero, HeroProgress, HeroSkeleton, TrophyBreakdown } from '../../src/components/hero'
import { currentData } from '../../src/components/nexo-brief.stories'
import type { CurrentGame } from '../../src/lib/types'
import { renderApp } from '../support/web'

const meta = () => document.querySelector('.meta')?.textContent
const progress = () => document.querySelector('.hero-progress')?.textContent

test('the current journey: platform, guide numbers, base-game progress and the next step', () => {
  renderApp(<Hero game={currentData} />)
  expect(screen.getByText('SUA JORNADA ATUAL')).toBeTruthy()
  expect(screen.getByText('PS4')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'DAYS GONE' })).toBeTruthy()
  expect(screen.getByText('A próxima platina se conquista um troféu de cada vez.')).toBeTruthy()
  expect(meta()).toContain('18h jogadas de ~70h')
  expect(progress()).toContain('12 de 46 troféus')
  expect(progress()).toContain('26%')
  expect(progress()).toContain('33 troféus faltam para a platina')
  expect(progress()).toContain('DLC 0/15')
  const bar = screen.getByRole('progressbar', { name: 'Progresso do jogo' })
  expect(bar.getAttribute('aria-valuenow')).toBe('26')
  expect(screen.getByRole('link', { name: /Conversar com o Nexo/ }).getAttribute('href')).toBe(
    '/nexo',
  )
})

test('compact on the home screen: continue the journey', () => {
  renderApp(<Hero game={currentData} compact />)
  expect(screen.getByRole('link', { name: /Continuar jornada/ }).getAttribute('href')).toBe('/game')
})

test('a call to action of its own replaces the default', () => {
  renderApp(<Hero game={currentData} cta={<button type="button">Salvar</button>} />)
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: /Conversar com o Nexo/ })).toBeNull()
})

test('with DLC counted, the numbers include it and the footnote goes', () => {
  renderApp(<Hero game={currentData} />, {
    value: { me: { ...SAMPLE_ME, includeDlcProgress: true } },
  })
  expect(progress()).toContain('12 de 61 troféus com DLC')
  expect(progress()).not.toContain('DLC 0/15')
})

test('a platinum earned, and a guide still being written', () => {
  const done: CurrentGame = {
    ...currentData,
    progress: 70,
    guide: null,
    trophies: currentData.trophies?.map((trophy) => ({ ...trophy, earned: true })) ?? [],
  }
  renderApp(<Hero game={done} />)
  expect(screen.getByText('Mais uma conquista para a sua história.')).toBeTruthy()
  expect(meta()).toBe(' 18h jogadasSeu guia está sendo preparado')
})

test('without hours played, the guide estimate alone', () => {
  renderApp(<Hero game={{ ...currentData, hoursPlayed: null, guide: null }} />)
  expect(meta()).toBe('Seu guia está sendo preparado')
})

test('a list without a confirmed platinum does not invent one', () => {
  renderApp(<HeroProgress game={{ earned: 9, total: 11, progress: 82, groups: undefined }} />)
  expect(progress()).toContain('9 de 11 troféus')
  expect(progress()).toContain('2 troféus pendentes')
  expect(progress()).not.toContain('para a platina')
})

test('no game: how to start one', () => {
  renderApp(<Hero game={null} />)
  expect(screen.getByRole('heading', { name: 'O próximo desafio é seu.' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Explorar minha biblioteca/ }).getAttribute('href')).toBe(
    '/discover',
  )
})

test('the skeleton, with or without the call to action', () => {
  const { container, rerender } = renderApp(<HeroSkeleton />)
  expect(container.querySelector('.cta .sk')).toBeTruthy()
  rerender(<HeroSkeleton cta={false} />)
  expect(container.querySelector('.cta')).toBeNull()
})

for (const includeDlcProgress of [false, true]) {
  test(`earned platinum and incomplete DLC in the hero with preference ${includeDlcProgress}`, () => {
    if (!currentData.groups) throw new Error('Fixture requires groups')
    const game: CurrentGame = {
      ...currentData,
      progress: 70,
      earned: 46,
      total: 61,
      trophies: currentData.trophies?.map((trophy) => ({ ...trophy, earned: true })) ?? [],
      groups: {
        ...currentData.groups,
        base: { ...currentData.groups.base, earned: 46, total: 46, remaining: 0 },
      },
    }
    renderApp(<Hero game={game} />, { value: { me: { ...SAMPLE_ME, includeDlcProgress } } })
    expect(progress()).toContain('Platina conquistada')
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      includeDlcProgress ? '75' : '100',
    )
    expect(screen.getByText('Mais uma conquista para a sua história.')).toBeTruthy()
  })
}

test('catalog tiers show exact compact counts with accessible names and keyboard tooltips', () => {
  const trophies = currentData.trophies.slice(0, 4).map((trophy, i) => ({
    ...trophy,
    type: (['platinum', 'gold', 'silver', 'bronze'] as const)[i],
  }))
  renderApp(<TrophyBreakdown trophies={trophies} />)
  expect(screen.getByText('4 troféus:')).toBeTruthy()
  for (const tier of ['platina', 'ouro', 'prata', 'bronze']) {
    const el = screen.getByRole('img', { name: `1 ${tier}` })
    expect(el.textContent?.trim()).toBe('1')
    expect(el.getAttribute('data-tip')).toBe(`1 ${tier}`)
    expect(el.getAttribute('tabindex')).toBe('0')
  }
})

test('catalog skeleton reserves the compact count row rather than personal progress', () => {
  const { container } = renderApp(<HeroSkeleton breakdown />)
  expect(container.querySelector('.trophy-counts-row')).toBeTruthy()
  expect(container.querySelector('.hero-progress')).toBeNull()
})
