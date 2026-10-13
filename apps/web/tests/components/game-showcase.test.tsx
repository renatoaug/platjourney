import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { GameAbout, GameGallery, GameShowcase } from '../../src/components/game-showcase'
import type { Game } from '../../src/lib/types'

const game: Game = {
  id: 'game:1',
  name: 'Days Gone',
  genres: ['Shooter', 'Role-playing (RPG)', 'Mystery'],
  modes: ['Single player', 'Co-operative'],
  rating: 76.4,
  platforms: ['PS4', 'PS5', 'PC'],
  developers: ['Bend Studio'],
  website: 'https://www.bendstudio.com/game/days-gone',
  released_at: '2019-04-26T00:00:00Z',
  screenshot_ids: ['a', 'b', 'c'],
}

const shown = () => (screen.getByAltText(/^Imagem \d de 3$/) as HTMLImageElement).alt

describe('GameGallery', () => {
  test('the arrows, the keyboard and a thumbnail move through the images, wrapping around', () => {
    render(<GameGallery ids={['a', 'b', 'c']} name="Days Gone" />)
    expect(shown()).toBe('Imagem 1 de 3')
    fireEvent.click(screen.getByRole('button', { name: 'Imagem anterior' }))
    expect(shown()).toBe('Imagem 3 de 3')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima imagem' }))
    expect(shown()).toBe('Imagem 1 de 3')
    fireEvent.keyDown(screen.getByRole('region', { name: 'Imagens de Days Gone' }), {
      key: 'ArrowRight',
    })
    expect(shown()).toBe('Imagem 2 de 3')
    fireEvent.click(screen.getByRole('button', { name: 'Imagem 3 de 3' }))
    expect(shown()).toBe('Imagem 3 de 3')
    expect(screen.getByRole('button', { name: 'Imagem 3 de 3' }).getAttribute('aria-current')).toBe(
      'true',
    )
  })

  test('a swipe changes the image and a tap does not', () => {
    const { container } = render(<GameGallery ids={['a', 'b']} name="X" />)
    const stage = container.querySelector('.gallery-stage') as HTMLElement
    fireEvent.pointerDown(stage, { clientX: 200 })
    fireEvent.pointerUp(stage, { clientX: 100 })
    expect((screen.getByAltText(/^Imagem \d de 2$/) as HTMLImageElement).alt).toBe('Imagem 2 de 2')
    fireEvent.pointerDown(stage, { clientX: 100 })
    fireEvent.pointerUp(stage, { clientX: 110 })
    expect((screen.getByAltText(/^Imagem \d de 2$/) as HTMLImageElement).alt).toBe('Imagem 2 de 2')
  })

  test('one image has only the expand button, and none shows nothing', () => {
    const { container, rerender } = render(<GameGallery ids={['a']} name="X" />)
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ver em tela cheia',
    ])
    rerender(<GameGallery ids={[]} name="X" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('GameAbout', () => {
  test('genres in Portuguese, the studio, the release day, the consoles and the site host', () => {
    render(<GameAbout game={game} name="Days Gone" />)
    expect(screen.getByText('Tiro')).toBeTruthy()
    expect(screen.getByText('RPG')).toBeTruthy()
    // A genre the list does not know keeps its catalog name.
    expect(screen.getByText('Mystery')).toBeTruthy()
    expect(screen.getByText('Desenvolvedor')).toBeTruthy()
    expect(screen.getByText('Bend Studio')).toBeTruthy()
    expect(screen.getByText('26 de abril de 2019')).toBeTruthy()
    expect(screen.getByText('Um jogador, Cooperativo')).toBeTruthy()
    expect(screen.getByText('76/100')).toBeTruthy()
    expect(screen.getByText('PS5')).toBeTruthy()
    expect(screen.queryByText('PC')).toBeNull()
    const link = screen.getByRole('link') as HTMLAnchorElement
    expect(link.textContent).toContain('bendstudio.com')
    expect(link.target).toBe('_blank')
  })

  test('two studios read as plural, and a link that is not http is left out', () => {
    render(
      <GameAbout
        game={{ id: 'game:2', name: 'X', developers: ['A', 'B'], website: 'javascript:alert(1)' }}
        name="X"
      />,
    )
    expect(screen.getByText('Desenvolvedores')).toBeTruthy()
    expect(screen.getByText('A, B')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('a game the catalog knows nothing about shows no card', () => {
    const { container } = render(<GameAbout game={{ id: 'game:3', name: 'X' }} name="X" />)
    expect(container.innerHTML).toBe('')
  })
})

test('without screenshots the facts take the whole width', () => {
  const { container } = render(
    <GameShowcase game={{ ...game, screenshot_ids: [] }} name="Days Gone" />,
  )
  expect(container.querySelector('.game-showcase.no-gallery')).toBeTruthy()
  expect(container.querySelector('.gallery')).toBeNull()
})

test('the expand button opens the image full screen, with its own arrows, and closes', () => {
  const { container } = render(<GameGallery ids={['a', 'b', 'c']} name="Days Gone" />)
  fireEvent.click(screen.getByRole('button', { name: 'Ver em tela cheia' }))
  const box = container.querySelector('.lightbox') as HTMLElement
  expect(box.textContent).toContain('1 de 3')
  fireEvent.keyDown(box, { key: 'ArrowRight' })
  expect(box.textContent).toContain('2 de 3')
  fireEvent.click(box.querySelector('.gallery-nav.prev') as HTMLElement)
  expect(box.textContent).toContain('1 de 3')
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(container.querySelector('.lightbox')).toBeNull()
})

test('a tap on the image opens it full screen; a click on the backdrop closes it', () => {
  const { container } = render(<GameGallery ids={['a']} name="X" />)
  const img = screen.getByAltText('Imagem 1 de 1')
  fireEvent.pointerDown(img, { clientX: 100 })
  fireEvent.pointerUp(img, { clientX: 102 })
  const box = container.querySelector('.lightbox') as HTMLElement
  expect(box).toBeTruthy()
  fireEvent.click(box)
  expect(container.querySelector('.lightbox')).toBeNull()
})
