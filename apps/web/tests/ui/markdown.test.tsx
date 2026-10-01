import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Markdown, UserText } from '../../src/ui/markdown'

test('Markdown renders Nexo text as escaped HTML', () => {
  const { container } = render(<Markdown text="**forte** <b>não</b>" className="md" />)
  const div = container.querySelector('div.md') as HTMLElement
  expect(div.querySelector('strong')?.textContent).toBe('forte')
  expect(div.querySelector('b')).toBeNull()
  render(<Markdown as="span" text="curto" />)
  expect(screen.getByText('curto').tagName).toBe('P')
  expect(screen.getByText('curto').parentElement?.tagName).toBe('SPAN')
})

test('UserText keeps only bold', () => {
  render(<UserText text="pegue **Isto é uma faca**" className="u" />)
  expect(screen.getByText('Isto é uma faca').tagName).toBe('STRONG')
})
