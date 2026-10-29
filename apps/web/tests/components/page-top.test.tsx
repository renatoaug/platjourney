import { expect, test } from 'bun:test'
import { screen } from '@testing-library/react'
import { PageTop } from '../../src/components/page-top'
import { renderApp } from '../support/web'

test('the title, its line, the controls under it and the card beside', () => {
  renderApp(
    <PageTop eyebrow="Eyebrow" title="Guias" lead="Uma linha" aside={<p>card</p>}>
      <input aria-label="busca" />
    </PageTop>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Guias' })).toBeTruthy()
  expect(screen.getByText('Uma linha')).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'busca' })).toBeTruthy()
  expect(screen.getByText('card')).toBeTruthy()
})

test('only a picture makes room for the art', () => {
  const { container } = renderApp(<PageTop title="Histórico" />)
  expect(container.querySelector('.page-top.on-art')).toBeNull()
})
