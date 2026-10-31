import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { CHAT_MAX, type ChatLoad, ChatSkeleton, NexoChat } from '../../../src/components/chat/chat'
import { Loaded, Pending } from '../../../src/components/chat/chat.stories'
import { fakeRecorder } from '../../support/recorder'
import { mockApi } from '../../support/web'

const messages = Loaded.args?.chat as ChatLoad
const pending = Pending.args?.chat as ChatLoad

const show = (chat: ChatLoad, { sending = false, onSend = () => {} } = {}) =>
  render(
    <MemoryRouter>
      <NexoChat
        chat={chat}
        sending={sending}
        subtitle="Falando sobre DAYS GONE (13%)."
        onSend={onSend}
      />
    </MemoryRouter>,
  )

const log = () => screen.getByRole('log', { name: 'Conversa com o Nexo' })
const box = () => screen.getByLabelText('Mensagem para Nexo') as HTMLTextAreaElement

describe('NexoChat', () => {
  test('shows the conversation with games, dates and sources', () => {
    show(messages)
    expect(screen.getByText('Falando sobre DAYS GONE (13%).')).toBeTruthy()
    expect(within(log()).getByText('Tem algum missable perto de onde estou?')).toBeTruthy()
    expect(within(log()).getAllByRole('link', { name: /Days Gone/ })).toHaveLength(4)
    expect(
      within(log())
        .getAllByRole('link', { name: /Days Gone/ })[0]
        .getAttribute('href'),
    ).toBe('/title/game/game%3A19561')
    expect(log().querySelectorAll('time')).toHaveLength(4)
    expect(within(log()).getByText(/Trophy Guides e Platinum Forum/)).toBeTruthy()
  })

  test('an empty conversation welcomes the player', () => {
    show([])
    expect(screen.getByRole('heading', { name: 'Sou o Nexo. Vamos à platina?' })).toBeTruthy()
  })

  test('loading shows the skeleton, a failure says so', () => {
    const { unmount } = show('loading')
    expect(log().querySelectorAll('.msg')).toHaveLength(3)
    unmount()
    show('error')
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar a conversa')
  })

  test('while sending, the just-sent message and the typing bubble show and sending is locked', () => {
    const onSend = mock()
    show(pending, { sending: true, onSend })
    expect(within(log()).getByText('Travei nessa parte.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Nexo está preparando uma resposta' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.change(box(), { target: { value: 'oi' } })
    fireEvent.submit(box().form as HTMLFormElement)
    expect(onSend).not.toHaveBeenCalled()
  })

  test('the first message can be sent while nothing came back yet', () => {
    show([], { sending: true })
    expect(screen.queryByText('Sou o Nexo. Vamos à platina?')).toBeNull()
    expect(screen.getByRole('img', { name: 'Nexo está preparando uma resposta' })).toBeTruthy()
  })

  test('a trophy from a tip link sits on the box and every question names it', () => {
    const onSend = mock()
    const onClearTrophy = mock()
    render(
      <MemoryRouter>
        <NexoChat
          chat={[]}
          sending={false}
          subtitle="Falando sobre DAYS GONE (13%)."
          onSend={onSend}
          trophy="Variedade dá gosto à vida"
          onClearTrophy={onClearTrophy}
          note="Você estava em Ghost of Tsushima."
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Você estava em Ghost of Tsushima.')).toBeTruthy()
    expect(box().getAttribute('placeholder')).toBe('Pergunte sobre o troféu…')
    fireEvent.click(screen.getByRole('button', { name: 'Como pegar?' }))
    expect(onSend).toHaveBeenCalledWith('Sobre o troféu **Variedade dá gosto à vida**: Como pegar?')
    fireEvent.change(box(), { target: { value: 'Onde fica a besta?' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSend).toHaveBeenLastCalledWith(
      'Sobre o troféu **Variedade dá gosto à vida**: Onde fica a besta?',
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Tirar o troféu Variedade dá gosto à vida da pergunta' }),
    )
    expect(onClearTrophy).toHaveBeenCalled()
  })

  test('a suggestion sends its full question', () => {
    const onSend = mock()
    show(messages, { onSend })
    fireEvent.click(screen.getByRole('button', { name: 'Travei aqui' }))
    expect(onSend).toHaveBeenCalledWith('Travei. Me explica o que fazer nessa parte sem spoiler.')
  })

  test('Enter sends the trimmed text and clears the box; Shift+Enter does not', () => {
    const onSend = mock()
    show(messages, { onSend })
    fireEvent.change(box(), { target: { value: '  e agora?  ' } })
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true })
    fireEvent.keyDown(box(), { key: 'a' })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('e agora?')
    expect(box().value).toBe('')
  })

  test('an empty message is not sent', () => {
    const onSend = mock()
    show(messages, { onSend })
    fireEvent.change(box(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(onSend).not.toHaveBeenCalled()
  })

  test('a message without a game or a valid date shows just the text', () => {
    show([
      { role: 'assistant', content: 'Sem data.', created_at: 'ontem' },
      { role: 'user', content: 'Também.' },
    ])
    expect(log().querySelector('time')).toBeNull()
    expect(within(log()).queryByRole('link')).toBeNull()
  })

  test('the skeleton renders three bubbles', () => {
    const { container } = render(<ChatSkeleton />)
    expect(container.querySelectorAll('.msg')).toHaveLength(3)
  })
})

test('the count always sits in the box, and the box takes up to the limit', () => {
  show(messages)
  expect(box().maxLength).toBe(CHAT_MAX)
  expect(screen.getByText(`0/${CHAT_MAX}`)).toBeTruthy()
  fireEvent.change(box(), { target: { value: 'a'.repeat(7) } })
  expect(screen.getByText(`7/${CHAT_MAX}`).className).toBe('chat-count')
  fireEvent.change(box(), { target: { value: 'a'.repeat(CHAT_MAX * 0.9) } })
  expect(screen.getByText(`${CHAT_MAX * 0.9}/${CHAT_MAX}`).className).toContain('near')
  fireEvent.change(box(), { target: { value: 'a'.repeat(CHAT_MAX) } })
  expect(screen.getByText(`${CHAT_MAX}/${CHAT_MAX}`).className).toContain('full')
})

test('a paste longer than what is left says it was cut', () => {
  show(messages)
  const paste = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { getData: () => string }
  }
  paste.clipboardData = { getData: () => 'b'.repeat(CHAT_MAX + 50) }
  fireEvent(box(), paste)
  fireEvent.change(box(), { target: { value: 'b'.repeat(CHAT_MAX) } })
  expect(screen.getByText(/Texto colado cortado em 1000 caracteres/)).toBeTruthy()
  fireEvent.change(box(), { target: { value: 'curto' } })
  expect(screen.queryByText(/Texto colado cortado/)).toBeNull()
})

test('the message box is sized from its text', () => {
  show(messages)
  fireEvent.change(box(), { target: { value: 'uma linha' } })
  expect(box().style.height).toMatch(/px$/)
  expect(box().style.overflowY).toBe('hidden')
})

describe('the game switch', () => {
  const games = [
    {
      np: 'NP1',
      name: 'Ghost of Tsushima',
      platform: 'PS5',
      icon: null,
      progress: 64,
      current: false,
    },
    { np: 'NP2', name: 'Ghostrunner II', platform: 'PS5', icon: null, progress: 0, current: true },
    {
      game: 'game:9',
      name: 'Ghost Exemplo',
      platform: 'PS5',
      icon: null,
      progress: null,
      current: false,
      owned: false,
    },
  ]
  const setup = () => {
    const searchGames = mock(async (_q: string) => games)
    const onPickGame = mock(() => {})
    const onSend = mock(() => {})
    render(
      <MemoryRouter>
        <NexoChat
          chat={[]}
          sending={false}
          subtitle="Falando sobre DAYS GONE (13%)."
          onSend={onSend}
          searchGames={searchGames}
          onPickGame={onPickGame}
        />
      </MemoryRouter>,
    )
    return { searchGames, onPickGame, onSend }
  }

  test('"/" lists the commands and picking /game starts it', () => {
    setup()
    fireEvent.change(box(), { target: { value: '/' } })
    const option = screen.getByRole('option', { name: /\/game/ })
    fireEvent.click(option)
    expect(box().value).toBe('/game ')
  })

  test('"/game" searches the player games; the arrows and Enter pick one, nothing goes to Nexo', async () => {
    const { searchGames, onPickGame, onSend } = setup()
    fireEvent.change(box(), { target: { value: '/game gho' } })
    expect(await screen.findByRole('option', { name: /Ghost of Tsushima/ })).toBeTruthy()
    expect(searchGames).toHaveBeenCalledWith('gho')
    expect(screen.getByText('atual')).toBeTruthy()
    // A catalog game outside the library comes after, marked, with no progress.
    const outside = screen.getByRole('option', { name: /Ghost Exemplo/ })
    expect(outside.textContent).toContain('fora da biblioteca')
    expect(outside.textContent).not.toContain('%')
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(box().getAttribute('aria-activedescendant')).toBe('chat-menu-1')
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    fireEvent.submit(box().closest('form') as HTMLFormElement)
    expect(onPickGame).toHaveBeenCalledWith(games[0])
    expect(onSend).not.toHaveBeenCalled()
    expect(box().value).toBe('')
  })

  test('Esc clears the command, and the subtitle opens the same list', () => {
    setup()
    fireEvent.change(box(), { target: { value: '/game x' } })
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(box().value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /Trocar o jogo da conversa/ }))
    expect(box().value).toBe('/game ')
  })

  test('while a picked game loads, the subtitle says so and the send button waits', () => {
    render(
      <MemoryRouter>
        <NexoChat
          chat={[]}
          sending={false}
          subtitle="Falando sobre DAYS GONE (13%)."
          onSend={() => {}}
          searchGames={async () => []}
          onPickGame={() => {}}
          switching="Ghost of Tsushima"
        />
      </MemoryRouter>,
    )
    const sub = screen.getByRole('button', { name: 'Trocando para Ghost of Tsushima…' })
    expect((sub as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})

describe('mic', () => {
  const w = window as Window & { webkitSpeechRecognition?: unknown }

  test('no mic where the device cannot dictate', () => {
    delete w.webkitSpeechRecognition
    show([])
    expect(screen.queryByRole('button', { name: 'Falar a pergunta' })).toBeNull()
  })

  test('what is said goes into the box after what was typed, for the player to send', async () => {
    w.webkitSpeechRecognition = class {
      lang = ''
      interimResults = false
      continuous = true
      onresult = (_e: unknown) => {}
      onerror = (_e: unknown) => {}
      onend = () => {}
      start() {
        this.onresult({ results: [{ isFinal: true, 0: { transcript: 'como pego?' } }] })
        this.onend()
      }
      stop() {}
    }
    const onSend = mock(() => {})
    show([], { onSend })
    const box = screen.getByRole('combobox') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Digno:' } })
    fireEvent.click(screen.getByRole('button', { name: 'Falar a pergunta' }))
    await screen.findByDisplayValue('Digno: como pego?')
    expect(onSend).not.toHaveBeenCalled()
    delete w.webkitSpeechRecognition
  })

  test('a recording is transcribed by the server and lands in the box after what was typed', async () => {
    const recorder = fakeRecorder({ heard: 'abc' })
    let answer = (_v: unknown) => {}
    const calls = mockApi({
      'POST /api/chat/transcribe': () => new Promise((done) => (answer = done)),
    })
    show([])
    const box = screen.getByRole('combobox') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'No Plague Tale:' } })
    fireEvent.click(screen.getByRole('button', { name: 'Falar a pergunta' }))
    await screen.findByRole('img', { name: 'Ouvindo. Toque em parar para virar texto.' })
    fireEvent.click(screen.getByRole('button', { name: 'Parar de ouvir' }))
    await screen.findByRole('img', { name: 'Transformando o áudio em texto…' })
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toEqual({ audio: btoa('abc'), mime: 'audio/webm;codecs=opus' })
    expect(recorder.track.stop).toHaveBeenCalled()
    answer({ text: 'onde fica a cripta?' })
    await screen.findByDisplayValue('No Plague Tale: onde fica a cripta?')
    recorder.restore()
  })

  test('while listening the box shows the wave, and the words come in only on stop', async () => {
    let run: { onresult: (e: unknown) => void; onend: () => void } | undefined
    w.webkitSpeechRecognition = class {
      lang = ''
      interimResults = false
      continuous = true
      onresult = (_e: unknown) => {}
      onerror = (_e: unknown) => {}
      onend = () => {}
      start() {
        run = this
      }
      stop() {
        this.onend()
      }
    }
    show([])
    fireEvent.click(screen.getByRole('button', { name: 'Falar a pergunta' }))
    await screen.findByRole('img', { name: 'Ouvindo. Toque em parar para virar texto.' })
    run?.onresult({ results: [{ isFinal: true, 0: { transcript: 'onde fica a cripta' } }] })
    expect(screen.queryByDisplayValue('onde fica a cripta')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Parar de ouvir' }))
    await screen.findByDisplayValue('onde fica a cripta')
    expect(screen.queryByRole('img', { name: /Ouvindo/ })).toBeNull()
    delete w.webkitSpeechRecognition
  })
})
