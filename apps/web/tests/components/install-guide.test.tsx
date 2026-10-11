import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { InstallGuide, installGuideDue, installPlatform } from '../../src/components/install-guide'

afterEach(() => localStorage.clear())

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15'

test('the phone is told apart from a computer, an iPad by its touch screen', () => {
  expect(installPlatform(IPHONE, 5)).toBe('ios')
  expect(installPlatform(ANDROID, 5)).toBe('android')
  expect(installPlatform(MAC, 0)).toBeNull()
  expect(installPlatform(MAC, 5)).toBe('ios')
})

test('on a computer the guide is never due', () => {
  expect(installGuideDue()).toBe(false)
})

test('the iPhone steps, and closing remembers the guide was seen', () => {
  const onDone = mock()
  render(<InstallGuide platform="ios" onDone={onDone} />)
  expect(screen.getByText(/Toque em Compartilhar/)).toBeTruthy()
  expect(screen.getByText(/Adicionar à Tela de Início/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Já instalei/ }))
  expect(onDone).toHaveBeenCalled()
  expect(localStorage.getItem('platjourney:install-guide-seen')).toBe('1')
})

test('on Android without the browser prompt, the menu steps and "not now"', () => {
  const onDone = mock()
  render(<InstallGuide platform="android" onDone={onDone} />)
  expect(screen.getByText(/menu ⋮/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
  expect(onDone).toHaveBeenCalled()
})
