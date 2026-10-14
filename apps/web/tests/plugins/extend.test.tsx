/** @jsxImportSource @platjourney/web/plugins */
// Bun compiles tests with the root tsconfig, which has no JSX settings: this file uses the app's runtime.
import { afterEach, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { extended, install, type ReplaceProps } from '../../src/plugins/extend'

afterEach(() => install([]))

// What the build does to every app component (plugin-targets.ts): tag it with its name.
function Price({ value }: { value: string }) {
  return <span>preço {value}</span>
}
Price.__target = 'Price'

function Card() {
  return (
    <div data-testid="card">
      <Price value="R$ 10" />
    </div>
  )
}

test('with no plugin every component is its own', () => {
  expect(extended(Price)).toBe(Price)
  render(<Card />)
  expect(screen.getByTestId('card').textContent).toBe('preço R$ 10')
})

test('a plugin puts its component before and after a target, with the same props', () => {
  install([
    {
      before: { Price: ({ value }) => <i>antes {value}</i> },
      after: { Price: ({ value }) => <b>depois {value}</b> },
    },
  ])
  render(<Card />)
  expect(screen.getByTestId('card').textContent).toBe('antes R$ 10preço R$ 10depois R$ 10')
})

test('a plugin replaces a target and can still show the original', () => {
  const Framed = ({ original }: ReplaceProps) => <em>[{original}]</em>
  install([{ replace: { Price: Framed } }])
  render(<Card />)
  expect(screen.getByTestId('card').textContent).toBe('[preço R$ 10]')
})

test('a replacement that renders the target itself gets the original, not itself again', () => {
  install([
    {
      replace: {
        Price: ({ value }) => (
          <u>
            <Price value={`${value}!`} />
          </u>
        ),
      },
    },
  ])
  render(<Card />)
  expect(screen.getByTestId('card').textContent).toBe('preço R$ 10!')
})

test('a plugin hides a target', () => {
  install([{ hide: ['Price'], after: { Price: () => <b>nunca</b> } }])
  render(<Card />)
  expect(screen.getByTestId('card').textContent).toBe('')
})

test('several plugins add up in order', () => {
  install([{ after: { Price: () => <b>1</b> } }, { after: { Price: () => <b>2</b> } }])
  render(<Card />)
  expect(screen.getByTestId('card').textContent).toBe('preço R$ 101' + '2')
})

test('a component is wrapped once, so React keeps its state', () => {
  install([{ after: { Price: () => null } }])
  expect(extended(Price)).toBe(extended(Price))
  expect(extended(Card)).toBe(Card)
})
