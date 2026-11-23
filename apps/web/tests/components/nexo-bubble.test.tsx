import { expect, test } from 'bun:test'
import { fireEvent, screen } from '@testing-library/react'
import { SAMPLE_DATA } from '../../src/app/app-state'
import { clampBubble, NexoBubble, newsHref, noteText } from '../../src/components/nexo-bubble'
import { renderApp } from '../support/web'

test('the floating Nexo stays inside the window and above the space a phone bottom bar takes', () => {
  expect(clampBubble({ x: -50, y: -50 }, 1280, 800)).toEqual({ x: 8, y: 8 })
  expect(clampBubble({ x: 5000, y: 5000 }, 1280, 800)).toEqual({ x: 1212, y: 732 })
  expect(clampBubble({ x: 5000, y: 5000 }, 375, 812, 70)).toEqual({ x: 307, y: 678 })
  expect(clampBubble({ x: 400, y: 300 }, 1280, 800)).toEqual({ x: 400, y: 300 })
})

test('while Nexo is held it shows it, and a finger moving does not scroll the page', () => {
  renderApp(<NexoBubble initial={{ x: 100, y: 100 }} />)
  const bubble = screen.getByRole('button', { name: 'Falar com o Nexo' })
  const swipe = () => {
    const move = new Event('touchmove', { cancelable: true, bubbles: true })
    bubble.dispatchEvent(move)
    return move.defaultPrevented
  }
  expect(swipe()).toBe(false)
  fireEvent.pointerDown(bubble, { button: 0, clientX: 130, clientY: 130 })
  // Held at once, before it moves: Nexo grows and glows.
  expect(bubble.classList.contains('is-held')).toBe(true)
  expect(swipe()).toBe(true)
  fireEvent.pointerUp(bubble)
  expect(bubble.classList.contains('is-held')).toBe(false)
  expect(swipe()).toBe(false)
})

const news = {
  count: 1,
  latest: {
    game: 'game:2050',
    np: 'NPWR05584_00',
    name: 'LEGO Marvel Super Heroes',
    content: 'Voltei com a resposta sobre os **99%** após usar código de trapaça.\nCódigos...',
    created_at: '2026-11-23T12:00:00Z',
  },
}

test('the message text the note shows: its first line, without markdown, cut short', () => {
  expect(noteText(news.latest.content)).toBe(
    'Voltei com a resposta sobre os 99% após usar código de trapaça.',
  )
  expect(noteText(`[Fonte](https://x.y) ${'a'.repeat(200)}`)).toHaveLength(90)
  expect(newsHref(news)).toBe('/nexo?game=NPWR05584_00&name=LEGO%20Marvel%20Super%20Heroes')
  expect(newsHref({ ...news, latest: { ...news.latest, game: null, np: null } })).toBe(
    '/nexo?history=none',
  )
})

test('a message from Nexo the player has not seen: a count, a note once, and a tap opens it', () => {
  localStorage.removeItem('platjourney:nexo-noted')
  const view = renderApp(<NexoBubble initial={{ x: 300, y: 600 }} />, {
    value: { data: { ...SAMPLE_DATA, nexo: news } },
  })
  const bubble = screen.getByRole('button', { name: 'O Nexo tem uma mensagem nova' })
  expect(bubble.classList.contains('is-calling')).toBe(true)
  expect(screen.getByText('LEGO Marvel Super Heroes')).toBeTruthy()
  // Closed, the note does not come back for the same message; the count stays until it is read.
  fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
  expect(screen.queryByText('LEGO Marvel Super Heroes')).toBeNull()
  view.unmount()
  renderApp(<NexoBubble initial={{ x: 300, y: 600 }} />, {
    value: { data: { ...SAMPLE_DATA, nexo: news } },
  })
  expect(screen.queryByText('LEGO Marvel Super Heroes')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'O Nexo tem uma mensagem nova' }))
  expect(screen.getByTestId('location').textContent).toContain('/nexo?game=NPWR05584_00')
  localStorage.removeItem('platjourney:nexo-noted')
})
