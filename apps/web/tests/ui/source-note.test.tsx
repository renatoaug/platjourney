import { expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SourceNote, splitSource } from '../../src/ui/source-note'

test('a source note shows where the advice came from', () => {
  render(<SourceNote text="Fonte: Trophy Guides" />)
  expect(screen.getByText('Fonte: Trophy Guides')).toBeTruthy()
})

test('splitSource takes the trailing "Fonte:" line off the answer', () => {
  expect(splitSource('Faça assim.\n\nFontes: Trophy Guides e Platinum Forum  ')).toEqual([
    'Faça assim.',
    'Fontes: Trophy Guides e Platinum Forum',
  ])
  expect(splitSource('Sem fonte.')).toEqual(['Sem fonte.', null])
  expect(splitSource()).toEqual(['', null])
})

test('a cited source links to its page or video minute, https only, in a new tab', () => {
  render(
    <SourceNote text="Fonte: [Canal Exemplo](https://www.youtube.com/watch?v=a&t=9s), [X](http://x.example) e Wiki" />,
  )
  const link = screen.getByRole('link', { name: 'Canal Exemplo' })
  expect(link.getAttribute('href')).toBe('https://www.youtube.com/watch?v=a&t=9s')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByText(/\[X\]\(http:\/\/x\.example\) e Wiki/)).toBeTruthy()
})
