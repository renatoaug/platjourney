import { afterEach, expect, jest, test } from 'bun:test'
import { act, fireEvent, render } from '@testing-library/react'
import { TooltipHost } from '../../src/ui/tooltip'

afterEach(() => {
  jest.useRealTimers()
})

function setup() {
  jest.useFakeTimers()
  const view = render(
    <>
      <button type="button" data-tip="Atualizar dados">
        <span>ícone</span>
      </button>
      <button type="button" data-tip="">
        vazio
      </button>
      <button type="button">sem dica</button>
      <TooltipHost />
    </>,
  )
  const tip = view.container.querySelector('.tooltip') as HTMLElement
  return { ...view, tip }
}

test('hovering an element with data-tip shows its text after a beat', () => {
  const { getByText, tip } = setup()
  fireEvent.mouseOver(getByText('ícone'))
  expect(tip.classList.contains('show')).toBe(false)
  act(() => jest.advanceTimersByTime(150))
  expect(tip.textContent).toBe('Atualizar dados')
  expect(tip.classList.contains('show')).toBe(true)
  expect(tip.getAttribute('aria-hidden')).toBe('true')
})

test('leaving the element hides it', () => {
  const { getByText, tip } = setup()
  fireEvent.mouseOver(getByText('ícone'))
  act(() => jest.advanceTimersByTime(150))
  fireEvent.mouseOut(getByText('ícone'))
  expect(tip.classList.contains('show')).toBe(false)
})

test('focus shows it too, and blur, click or scroll hide it', () => {
  const { getByText, tip } = setup()
  const button = getByText('ícone').closest('button') as HTMLElement
  for (const hide of [
    () => fireEvent.focusOut(button),
    () => fireEvent.click(document.body),
    () => fireEvent.scroll(window),
  ]) {
    fireEvent.focusIn(button)
    act(() => jest.advanceTimersByTime(150))
    expect(tip.classList.contains('show')).toBe(true)
    hide()
    expect(tip.classList.contains('show')).toBe(false)
  }
})

test('elements without a tip, or with an empty one, show nothing', () => {
  const { getByText, tip } = setup()
  fireEvent.mouseOver(getByText('sem dica'))
  fireEvent.mouseOut(getByText('sem dica'))
  fireEvent.mouseOver(getByText('vazio'))
  act(() => jest.advanceTimersByTime(150))
  expect(tip.classList.contains('show')).toBe(false)
})

test('near the top it flips below the element', () => {
  const { getByText, tip } = setup()
  // happy-dom lays nothing out: every rect sits at the top, so there is no room above.
  fireEvent.mouseOver(getByText('ícone'))
  act(() => jest.advanceTimersByTime(150))
  expect(tip.classList.contains('below')).toBe(true)
})

test('a press hides it even where the click stops, and a tip removed meanwhile never shows', () => {
  const { getByText, tip } = setup()
  const button = getByText('ícone').closest('button') as HTMLElement
  button.addEventListener('click', (e) => e.stopPropagation())
  fireEvent.mouseOver(button)
  act(() => jest.advanceTimersByTime(150))
  fireEvent.pointerDown(button)
  fireEvent.click(button)
  expect(tip.classList.contains('show')).toBe(false)

  // Pressed before the beat: the panel opened and the button dropped its tip.
  fireEvent.mouseOver(button)
  button.removeAttribute('data-tip')
  act(() => jest.advanceTimersByTime(150))
  expect(tip.classList.contains('show')).toBe(false)
})
