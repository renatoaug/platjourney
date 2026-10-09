import './env.ts'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'
import { botInfo, botUsername, incomingMessages, sendMessage, sendTyping } from '../src/telegram.ts'

afterEach(() => mock.restore())

const ok = (result: unknown = true) => Response.json({ ok: true, result })
const okFetch = (async () => ok()) as unknown as typeof fetch
const sent = (fetch: { mock: { calls: unknown[][] } }) =>
  fetch.mock.calls.map(([url, init]) => ({
    method: String(url).split('/').at(-1),
    body: JSON.parse((init as RequestInit).body as string),
  }))

test('messages go out as escaped HTML', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(okFetch)
  await sendMessage('42', '**Platina** em *Days Gone* com `R2` & <3')
  const [{ method, body }] = sent(fetch)
  expect(method).toBe('sendMessage')
  expect(body).toMatchObject({ chat_id: '42', parse_mode: 'HTML' })
  expect(body.text).toBe('<b>Platina</b> em <i>Days Gone</i> com <code>R2</code> &amp; &lt;3')
})

test('a cited source becomes a link, https only', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(okFetch)
  await sendMessage(
    '42',
    'Fonte: [Canal Exemplo](https://www.youtube.com/watch?v=a&t=9s), [X](http://x.example)',
  )
  expect(sent(fetch)[0].body.text).toBe(
    'Fonte: <a href="https://www.youtube.com/watch?v=a&amp;t=9s">Canal Exemplo</a>, [X](http://x.example)',
  )
})

test('long messages are split in chunks', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(okFetch)
  await sendMessage('42', 'a'.repeat(9000))
  expect(sent(fetch).map((c) => c.body.text.length)).toEqual([4000, 4000, 1000])
})

test('rejected markup falls back to plain text', async () => {
  const fetch = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ ok: false, description: "can't parse entities" }))
    .mockResolvedValueOnce(ok())
  await sendMessage('42', '**a')
  const [first, second] = sent(fetch)
  expect(first.body.parse_mode).toBe('HTML')
  expect(second.body).toEqual({
    chat_id: '42',
    text: '**a',
    link_preview_options: { is_disabled: true },
  })
})

test('a dropped connection is tried once more', async () => {
  const fetch = spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('socket connection was closed'))
    .mockResolvedValueOnce(ok())
  await sendTyping('42')
  expect(sent(fetch)).toEqual([
    { method: 'sendChatAction', body: { chat_id: '42', action: 'typing' } },
    { method: 'sendChatAction', body: { chat_id: '42', action: 'typing' } },
  ])
})

test('the bot is asked who it is only once', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(
    ok({ username: 'platjourney_bot', first_name: 'Nexo' }),
  )
  expect(await botInfo()).toEqual({ username: 'platjourney_bot', name: 'Nexo' })
  expect(await botUsername()).toBe('platjourney_bot')
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('incoming updates yield text messages and move the offset', async () => {
  spyOn(console, 'error').mockImplementation(() => {})
  const fetch = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ ok: false, description: 'conflict' }))
    .mockResolvedValueOnce(
      ok([
        { update_id: 10, message: { chat: { id: 1 }, text: 'oi' } },
        { update_id: 11, message: { chat: { id: 2 } } },
        { update_id: 12, message: { chat: { id: 3 }, text: '/help' } },
      ]),
    )
    .mockResolvedValueOnce(ok([{ update_id: 13, message: { chat: { id: 4 }, text: 'tchau' } }]))
  const messages = incomingMessages()
  expect((await messages.next()).value).toEqual({ chatId: '1', text: 'oi' })
  expect((await messages.next()).value).toEqual({ chatId: '3', text: '/help' })
  expect((await messages.next()).value).toEqual({ chatId: '4', text: 'tchau' })
  await messages.return(undefined)
  expect(sent(fetch).map((c) => c.body.offset)).toEqual([0, 0, 13])
})
