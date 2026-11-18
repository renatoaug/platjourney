import { expect, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { postLinks, ShareTargets } from '../../src/components/share-targets'
import { renderApp } from '../support/web'

const LINK = 'https://app.example.com/profiles/Kratos?ref=share'

test('each place opens its posting screen with the line and the link filled in', () => {
  const links = Object.fromEntries(postLinks('Platinei Ódin! 🏆', LINK).map((p) => [p.key, p.href]))
  const x = new URL(links.x as string)
  expect(x.hostname).toBe('x.com')
  expect(x.searchParams.get('text')).toBe('Platinei Ódin! 🏆')
  expect(x.searchParams.get('url')).toBe(LINK)
  expect(new URL(links.whatsapp as string).searchParams.get('text')).toBe(
    `Platinei Ódin! 🏆\n${LINK}`,
  )
  expect(new URL(links.telegram as string).searchParams.get('url')).toBe(LINK)
  const reddit = new URL(links.reddit as string)
  expect(reddit.searchParams.get('title')).toBe('Platinei Ódin! 🏆')
  expect(reddit.searchParams.get('text')).toBe(LINK)
})

test('the panel says the image is copied, links each place in a new tab and closes', () => {
  let closed = false
  renderApp(
    <ShareTargets
      image="blob:x"
      text="Platinei!"
      link={LINK}
      copied
      onClose={() => (closed = true)}
    />,
  )
  expect(screen.getByText(/A imagem está copiada/)).toBeTruthy()
  for (const name of ['X', 'Reddit', 'WhatsApp', 'Telegram'])
    expect(screen.getByRole('link', { name }).getAttribute('target')).toBe('_blank')
  fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
  expect(closed).toBe(true)
})

test('when the image could not be copied, it says the file was saved to attach', () => {
  renderApp(
    <ShareTargets image="blob:x" text="Platinei!" link={LINK} copied={false} onClose={() => {}} />,
  )
  expect(screen.getByText(/anexe o arquivo/)).toBeTruthy()
})
