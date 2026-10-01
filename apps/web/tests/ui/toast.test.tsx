import { afterEach, expect, jest, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ToastHost, toast } from '../../src/ui/toast'

afterEach(() => {
  jest.useRealTimers()
})

test('nothing shows until a toast is sent', () => {
  const { container } = render(<ToastHost />)
  expect(container.innerHTML).toBe('')
})

test('an error is announced as an alert', () => {
  render(<ToastHost />)
  act(() => toast('Não deu.'))
  const el = screen.getByRole('alert')
  expect(el.textContent).toBe('Não deu.')
  expect(el.className).toContain('error')
})

test('a success is a status with its burst and its action link', () => {
  render(<ToastHost />)
  act(() => toast('Salvo', 'success', { href: '#/goals', label: 'Ver' }))
  const el = screen.getByRole('status')
  expect(el.textContent).toContain('Salvo')
  expect(el.querySelectorAll('.burst i')).toHaveLength(10)
  expect(screen.getByRole('link', { name: 'Ver' }).getAttribute('href')).toBe('#/goals')
})

test('info is neutral: no mark', () => {
  render(<ToastHost />)
  act(() => toast('Código copiado', 'info'))
  expect(screen.getByRole('status').querySelector('.toast-mark')).toBeNull()
})

test('an unknown kind is a programming error', () => {
  expect(() => toast('x', 'warning' as 'info')).toThrow('toast kind must be one of')
})

test('it leaves on its own', () => {
  jest.useFakeTimers()
  render(<ToastHost />)
  act(() => toast('Não deu.'))
  act(() => jest.advanceTimersByTime(3500))
  expect(screen.getByRole('alert').className).toContain('leave')
  act(() => jest.advanceTimersByTime(400))
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a click dismisses it early, but not a click on its link', () => {
  jest.useFakeTimers()
  render(<ToastHost />)
  act(() => toast('Salvo', 'success', { href: '#/goals', label: 'Ver' }))
  fireEvent.click(screen.getByRole('link', { name: 'Ver' }))
  expect(screen.getByRole('status').className).not.toContain('leave')
  fireEvent.click(screen.getByRole('status'))
  expect(screen.getByRole('status').className).toContain('leave')
  act(() => jest.advanceTimersByTime(400))
  expect(screen.queryByRole('status')).toBeNull()
})

test('without a host, toast does nothing', () => {
  expect(() => toast('ninguém ouve')).not.toThrow()
})
