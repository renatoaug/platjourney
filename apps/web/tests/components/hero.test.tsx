import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Hero, HeroProgress, HeroSkeleton } from '../../src/components/hero'
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
  const done: CurrentGame = { ...currentData, progress: 100, guide: null }
  renderApp(<Hero game={done} />)
  expect(screen.getByText('Mais uma conquista para a sua história.')).toBeTruthy()
  expect(meta()).toBe(' 18h jogadasSeu guia está sendo preparado')
})

test('without hours played, the guide estimate alone', () => {
  renderApp(<Hero game={{ ...currentData, hoursPlayed: null, guide: null }} />)
  expect(meta()).toBe('Seu guia está sendo preparado')
})

test('a list without groups counts the whole list, one trophy short of the platinum', () => {
  renderApp(<HeroProgress game={{ earned: 9, total: 11, progress: 82, groups: undefined }} />)
  expect(progress()).toContain('9 de 11 troféus')
  expect(progress()).toContain('1 troféu falta para a platina')
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
