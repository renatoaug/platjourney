import { expect, mock, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { CommunityReactions } from '../../../src/components/community/community-reactions'
import { communityEvents } from '../../../src/fixtures'
import { renderApp } from '../../support/web'

const event = {
  ...communityEvents[0],
  reactions: { counts: { like: 2, gg: 0, fire: 0, wow: 0, skull: 1 }, mine: ['like' as const] },
}

test('the pill shows the reactions given and their total, and a tap opens the three to pick', () => {
  const onReact = mock(() => {})
  const { container } = renderApp(<CommunityReactions event={event} name="Ana" onReact={onReact} />)
  const pill = container.querySelector('.community-react') as HTMLButtonElement
  expect(pill.textContent).toBe('3')
  expect(pill.className).toContain('mine')
  expect(container.querySelectorAll('.community-react-face')).toHaveLength(2)
  fireEvent.click(pill)
  expect(pill.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Fogo: 0' }))
  expect(onReact).toHaveBeenCalledWith('fire')
  expect(container.querySelector('.community-react-bar')).toBeNull()
  expect(container.querySelector('.community-react-plus')?.textContent).toBe('+1')
})

test('with no reaction yet the pill invites to react; the demo cannot open it', () => {
  const quiet = {
    ...event,
    reactions: { counts: { like: 0, gg: 0, fire: 0, wow: 0, skull: 0 }, mine: [] },
  }
  const { container } = renderApp(
    <CommunityReactions event={quiet} name="Ana" onReact={() => {}} readOnly />,
  )
  const pill = container.querySelector('.community-react') as HTMLButtonElement
  expect(pill.textContent).toBe('Reagir')
  expect(pill.disabled).toBe(true)
  fireEvent.click(pill)
  expect(container.querySelector('.community-react-bar')).toBeNull()
})
