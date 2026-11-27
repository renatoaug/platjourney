import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { GameOverview } from '../../src/components/game-overview'
import { current } from '../../src/fixtures'
import { mockApi, renderApp } from '../support/web'

const overview = (mapCount?: number) =>
  renderApp(
    <GameOverview
      game={current}
      progress={current.progress}
      includeDlc={false}
      onOpen={() => {}}
      trophies={null}
      mapCount={mapCount}
    />,
  )

test('a game with a map gets its row, with how many spots it has', () => {
  mockApi({ '/api/plan': { plan: null } })
  const { unmount } = overview(788)
  expect(screen.getByText('788 pontos para coletar, no mapa do jogo')).toBeTruthy()
  unmount()
  overview(1)
  expect(screen.getByText('1 ponto para coletar, no mapa do jogo')).toBeTruthy()
})

test('a game without a map has no map row', () => {
  mockApi({ '/api/plan': { plan: null } })
  overview()
  expect(screen.queryByText('Mapa')).toBeNull()
})
