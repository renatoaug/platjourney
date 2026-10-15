import { expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Pager, pageItems } from '../../src/ui/pager'

test('the pager hides when one page is enough', () => {
  const { container } = render(<Pager page={1} size={8} total={8} onPage={() => {}} />)
  expect(container.innerHTML).toBe('')
})

test('page numbers keep the ends and the neighbours, with gaps between', () => {
  expect(pageItems(1, 1)).toEqual([1])
  expect(pageItems(1, 4)).toEqual([1, 2, 3, 4])
  expect(pageItems(1, 17)).toEqual([1, 2, null, 17])
  expect(pageItems(2, 17)).toEqual([1, 2, 3, null, 17])
  expect(pageItems(9, 17)).toEqual([1, null, 8, 9, 10, null, 17])
  expect(pageItems(4, 17)).toEqual([1, 2, 3, 4, 5, null, 17])
  expect(pageItems(17, 17)).toEqual([1, null, 16, 17])
})

test('the pager shows the range and turns pages', () => {
  const onPage = mock()
  const { rerender } = render(<Pager page={1} size={8} total={25} onPage={onPage} />)
  expect(screen.getByRole('navigation', { name: 'Páginas' }).textContent).toContain('1–8 de 25')
  expect(screen.getByRole('button', { name: 'Página 1' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('button', { name: 'Página anterior' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(screen.queryByRole('button', { name: 'Primeira página' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(onPage).toHaveBeenLastCalledWith(2)
  fireEvent.click(screen.getByRole('button', { name: 'Página 3' }))
  expect(onPage).toHaveBeenLastCalledWith(3)
  fireEvent.click(screen.getByRole('button', { name: 'Página 4' }))
  expect(onPage).toHaveBeenLastCalledWith(4)
  onPage.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Página 1' }))
  expect(onPage).not.toHaveBeenCalled()

  rerender(<Pager page={4} size={8} total={25} onPage={onPage} label="Páginas de jogos" />)
  expect(screen.getByRole('navigation', { name: 'Páginas de jogos' }).textContent).toContain(
    '25–25 de 25',
  )
  expect(screen.getByRole('button', { name: 'Próxima página' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Página 1' }))
  expect(onPage).toHaveBeenLastCalledWith(1)
})

test('a busy pager locks every button', () => {
  render(<Pager page={2} size={8} total={25} onPage={() => {}} disabled />)
  for (const b of screen.getAllByRole('button')) expect(b.hasAttribute('disabled')).toBe(true)
})

test('the arrows look: previous, the page count and next, no numbers', () => {
  const onPage = mock()
  render(<Pager page={1} size={6} total={14} onPage={onPage} look="arrows" />)
  expect(screen.getByText('1/3').getAttribute('title')).toBe('Página 1 de 3')
  expect(screen.queryByRole('button', { name: 'Página 2' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Página anterior' }).hasAttribute('disabled')).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(onPage).toHaveBeenCalledWith(2)
})
