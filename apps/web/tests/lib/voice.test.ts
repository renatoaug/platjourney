import { afterEach, describe, expect, mock, test } from 'bun:test'
import { canDictate, dictate } from '../../src/lib/voice'

type W = Window & {
  Capacitor?: unknown
  webkitSpeechRecognition?: unknown
  SpeechRecognition?: unknown
}
const w = window as W

afterEach(() => {
  delete w.Capacitor
  delete w.webkitSpeechRecognition
  delete w.SpeechRecognition
})

// A browser recognizer that hears the given phrase when started.
function fakeWeb(heard: string[], error?: string) {
  const made: { lang?: string }[] = []
  w.webkitSpeechRecognition = class {
    lang = ''
    interimResults = false
    continuous = true
    onresult = (_e: unknown) => {}
    onerror = (_e: unknown) => {}
    onend = () => {}
    constructor() {
      made.push(this)
    }
    start() {
      this.onresult({ results: heard.map((t) => ({ isFinal: true, 0: { transcript: t } })) })
      if (error) this.onerror({ error })
      this.onend()
    }
    stop() {}
  }
  return made
}

describe('dictation', () => {
  test('with no recognizer there is nothing to dictate with', () => {
    expect(canDictate()).toBe(false)
  })

  test("the browser's recognizer fills the text in the language asked", async () => {
    const made = fakeWeb(['como pego ', 'o troféu'])
    expect(canDictate()).toBe(true)
    const texts: string[] = []
    const end = mock(() => {})
    await dictate('pt-BR', { onText: (t) => texts.push(t), onEnd: end })
    expect(made[0].lang).toBe('pt-BR')
    expect(texts).toEqual(['como pego o troféu'])
    expect(end).toHaveBeenCalledWith(undefined)
  })

  test('a refused microphone ends as denied; silence is not an error', async () => {
    fakeWeb([], 'not-allowed')
    const denied = mock(() => {})
    await dictate('en-US', { onText: () => {}, onEnd: denied })
    expect(denied).toHaveBeenCalledWith('denied')
    fakeWeb([], 'no-speech')
    const quiet = mock(() => {})
    await dictate('en-US', { onText: () => {}, onEnd: quiet })
    expect(quiet).toHaveBeenCalledWith(undefined)
  })

  test("in the app, the phone's recognizer is used, after asking for permission", async () => {
    fakeWeb(['browser'])
    const listeners: Record<string, (d: unknown) => void> = {}
    const start = mock(() => Promise.resolve())
    w.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SpeechRecognition: {
          available: () => Promise.resolve({ available: true }),
          requestPermissions: () => Promise.resolve({ speechRecognition: 'granted' }),
          start,
          stop: () => Promise.resolve(),
          addListener: (event: string, fn: (d: unknown) => void) => {
            listeners[event] = fn
            return Promise.resolve({ remove: () => Promise.resolve() })
          },
        },
      },
    }
    const texts: string[] = []
    const end = mock(() => {})
    await dictate('en-US', { onText: (t) => texts.push(t), onEnd: end })
    expect(start).toHaveBeenCalledWith({ language: 'en-US', partialResults: true, popup: false })
    listeners.partialResults({ matches: ['what is left'] })
    listeners.listeningState({ status: 'stopped' })
    expect(texts).toEqual(['what is left'])
    expect(end).toHaveBeenCalledWith(undefined)
  })

  test('in the app, a refused permission ends as denied without listening', async () => {
    const start = mock(() => Promise.resolve())
    w.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SpeechRecognition: {
          available: () => Promise.resolve({ available: true }),
          requestPermissions: () => Promise.resolve({ speechRecognition: 'denied' }),
          start,
          stop: () => Promise.resolve(),
          addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
        },
      },
    }
    const end = mock(() => {})
    await dictate('pt-BR', { onText: () => {}, onEnd: end })
    expect(end).toHaveBeenCalledWith('denied')
    expect(start).not.toHaveBeenCalled()
  })
})
