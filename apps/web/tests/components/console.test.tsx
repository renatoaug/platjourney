import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { Console } from '../../src/components/console'
import { rankingData } from '../../src/components/game-cards.stories'
import { currentData } from '../../src/components/nexo-brief.stories'
import { profileData } from '../../src/pages/profile.stories'
import { mockApi, renderApp } from '../support/web'

beforeEach(() => {
  mockApi({ '/api/profile': profileData })
})

afterEach(() => mock.restore())

const data = { ...SAMPLE_DATA, current: currentData, ranking: rankingData }
const title = () => screen.getByRole('heading', { level: 2 }).textContent
const path = () => screen.getByTestId('location').textContent

test('the game played comes first, then the radar, then the platinums', async () => {
  renderApp(<Console data={data} />)
  expect(title()).toBe(currentData.name)
  expect(screen.getByText('Jogando agora')).toBeTruthy()
  expect(await screen.findByText('Platinados')).toBeTruthy()
})

test('the arrows move along the shelf; a second press on the focused cover opens the game', () => {
  renderApp(<Console data={data} />)
  const first = screen.getByRole('button', { name: currentData.name })
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  expect(title()).toBe(rankingData[1].name)
  expect(screen.getByText('No radar da platina')).toBeTruthy()
  const second = screen.getByRole('button', { name: rankingData[1].name })
  fireEvent.click(second)
  expect(path()).toBe(`/title/game/${encodeURIComponent(rankingData[1].game)}`)
})

test('the game played opens on its own screen', () => {
  renderApp(<Console data={data} />)
  fireEvent.click(screen.getByRole('button', { name: /Abrir jogo/ }))
  expect(path()).toBe('/game')
})

test('nothing played and nothing in progress: how to start', () => {
  mockApi({ '/api/profile': { ...profileData, platinums: [] } })
  renderApp(<Console data={{ ...SAMPLE_DATA, current: null, ranking: [] }} />)
  expect(screen.getByText('Jogue algo na PSN e ele aparece aqui, com a arte do jogo.')).toBeTruthy()
})
