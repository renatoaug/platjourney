import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { PageHero } from '../../src/components/page-hero'

test('the title and lead over the art; the shelf keeps one row, the others fill the top', () => {
  const covers = Array.from({ length: 10 }, (_, i) => `/c${i}.jpg`)
  const { container, rerender } = render(
    <PageHero
      eyebrow="LISTA"
      title="Interesses"
      lead="Os seus jogos"
      images={covers}
      look="shelf"
    />,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Interesses' })).toBeTruthy()
  expect(container.querySelectorAll('.page-hero-art img')).toHaveLength(8)
  rerender(<PageHero title="Guias" images={covers} look="covers" />)
  expect(container.querySelectorAll('.page-hero-art img')).toHaveLength(20)
  rerender(<PageHero title="Guias" images={[]} look="art" />)
  expect(container.querySelector('.page-hero-art')).toBeNull()
})
