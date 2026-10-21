import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import { deliver, plainText } from '../src/notify.ts'
import * as push from '../src/push.ts'
import * as telegram from '../src/telegram.ts'
import { makeUser } from './fixtures.ts'

let send: ReturnType<typeof spyOn<typeof telegram, 'sendMessage'>>
let pushed: ReturnType<typeof spyOn<typeof push, 'pushTo'>>

beforeEach(() => {
  send = spyOn(telegram, 'sendMessage').mockResolvedValue()
  pushed = spyOn(push, 'pushTo').mockResolvedValue(1)
  spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => mock.restore())

test('markdown becomes plain text for a notification', () => {
  expect(
    plainText('🏆 **Troféu**\n\n- **A**: dica com `code` e [link](https://x.y)\n\n\n\n# Fim'),
  ).toBe('🏆 Troféu\n\n• A: dica com code e link\n\nFim')
})

test('a notice goes to Telegram and to push', async () => {
  const user = makeUser({ telegram_chat_id: '42' })
  await deliver(user, '**Oi**')
  expect(send).toHaveBeenCalledWith('42', '**Oi**')
  expect(pushed).toHaveBeenCalledWith(user, { title: 'Nexo', body: 'Oi', url: '/history' })
})

test('Telegram is skipped when not linked or turned off', async () => {
  await deliver(makeUser({ telegram_chat_id: null }), 'a')
  await deliver(makeUser({ telegram_chat_id: '42', notify_telegram: false }), 'b')
  expect(send).not.toHaveBeenCalled()
  expect(pushed).toHaveBeenCalledTimes(2)
})

test('a long notice is cut for push, and a failing channel does not stop the other', async () => {
  send.mockRejectedValue(new Error('blocked'))
  pushed.mockRejectedValue(new Error('down'))
  await deliver(makeUser({ telegram_chat_id: '42' }), 'x'.repeat(2000))
  const body = (pushed.mock.calls[0][1] as push.PushMessage).body
  expect(body.length).toBe(900)
  expect(body.endsWith('…')).toBe(true)
})
