import { afterEach, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import { BuddyAvatar } from '../../src/components/buddy-avatar'
import { defineMessages, Language, useMessages } from '../../src/i18n/i18n'
import { setBuddy } from '../../src/lib/buddy'

afterEach(() => act(() => setBuddy(undefined, null)))

const messages = defineMessages({
  [Language.PtBR]: { ask: 'Pergunte ao Nexo' },
  [Language.En]: { ask: 'Ask Nexo' },
})
function Ask() {
  const t = useMessages(messages)
  return <p>{t('ask')}</p>
}

test('Nexo stays its own drawing until the player picks another buddy, which shows in its place', () => {
  const { container } = render(<BuddyAvatar className="nexo-avatar" />)
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/nexo-avatar.svg')
  act(() => setBuddy('coffee', null))
  const img = container.querySelector('img')
  expect(img?.getAttribute('src')).toStartWith('/buddies/coffee/')
  expect(img?.className).toBe('buddy-avatar nexo-avatar')
  expect(img?.dataset.buddyMotion).toBeDefined()
})

test('the texts on screen take the name the player gave their buddy at once', () => {
  const { container } = render(<Ask />)
  expect(container.textContent).toBe('Pergunte ao Nexo')
  act(() => setBuddy('bomb', 'Kaboom'))
  expect(container.textContent).toBe('Pergunte ao Kaboom')
})
