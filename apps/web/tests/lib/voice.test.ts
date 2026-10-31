import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { base64, canDictate, canRecord, dictate, record } from '../../src/lib/voice'
import { fakeRecorder } from '../support/recorder'

type W = Window & {
  Capacitor?: unknown
  webkitSpeechRecognition?: unknown
  SpeechRecognition?: unknown
}
const w = window as W

afterEach(() => {
  mock.restore()
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

  test('a pause does not end it: it listens on, keeping the text, until stop', async () => {
    let now = 1_000
    spyOn(Date, 'now').mockImplementation(() => now)
    const runs: { onresult: (e: unknown) => void; onend: () => void; stop: () => void }[] = []
    const stop = mock(() => {})
    w.webkitSpeechRecognition = class {
      lang = ''
      interimResults = false
      continuous = false
      onresult = (_e: unknown) => {}
      onerror = (_e: unknown) => {}
      onend = () => {}
      start() {
        runs.push(this)
      }
      stop = stop
    }
    const hear = (t: string) =>
      runs.at(-1)?.onresult({ results: [{ isFinal: true, 0: { transcript: t } }] })
    const texts: string[] = []
    const end = mock(() => {})
    const d = await dictate('pt-BR', { onText: (t) => texts.push(t), onEnd: end })
    hear('como pego')
    now += 4_000
    runs[0].onend()
    expect(runs).toHaveLength(2)
    expect(end).not.toHaveBeenCalled()
    hear('o troféu')
    expect(texts.at(-1)).toBe('como pego o troféu')
    d.stop()
    expect(stop).toHaveBeenCalled()
    runs[1].onend()
    expect(runs).toHaveLength(2)
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
    // The phone keeps the session through pauses itself, without a beep at each restart.
    expect(start).toHaveBeenCalledWith({
      language: 'en-US',
      partialResults: true,
      popup: false,
      continuousPTT: true,
      muteRecognizerBeep: true,
    })
    listeners.partialResults({ matches: ['what is left'] })
    listeners.listeningState({ status: 'stopped' })
    expect(texts).toEqual(['what is left'])
    expect(end).toHaveBeenCalledWith(undefined)
  })

  test('in the app, the text spans the pauses and the voice level drives the wave', async () => {
    const listeners: Record<string, (d: unknown) => void> = {}
    const stop = mock(() => Promise.resolve())
    w.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        SpeechRecognition: {
          available: () => Promise.resolve({ available: true }),
          requestPermissions: () => Promise.resolve({ speechRecognition: 'granted' }),
          start: () => Promise.resolve(),
          stop,
          addListener: (event: string, fn: (d: unknown) => void) => {
            listeners[event] = fn
            return Promise.resolve({ remove: () => Promise.resolve() })
          },
        },
      },
    }
    const texts: string[] = []
    const levels: number[] = []
    const d = await dictate('pt-BR', {
      onText: (t) => texts.push(t),
      onEnd: () => {},
      onLevel: (l) => levels.push(l),
    })
    listeners.audioLevel({ level: 0.6 })
    listeners.partialResults({ accumulated: 'onde fica', matches: ['a cripta'] })
    listeners.partialResults({ accumulatedText: 'onde fica a cripta?' })
    expect(texts).toEqual(['onde fica a cripta', 'onde fica a cripta?'])
    expect(levels).toEqual([0.6])
    d.stop()
    expect(stop).toHaveBeenCalled()
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

describe('recording', () => {
  test('a refused microphone ends as denied and records nothing', async () => {
    const recorder = fakeRecorder({ refuse: true })
    expect(canRecord()).toBe(true)
    const end = mock(() => {})
    const audio = mock(() => {})
    await record({ onLevel: () => {}, onAudio: audio, onEnd: end })
    expect(end).toHaveBeenCalledWith('denied')
    expect(audio).not.toHaveBeenCalled()
    recorder.restore()
    expect(canRecord()).toBe(false)
  })

  test('stop hands over the audio, frees the microphone and the voice level moves', async () => {
    const recorder = fakeRecorder({ heard: 'abc' })
    const levels: number[] = []
    let got: Blob | undefined
    const r = await record({
      onLevel: (l) => levels.push(l),
      onAudio: (a) => (got = a),
      onEnd: () => {},
    })
    r.stop()
    expect(got?.type).toBe('audio/webm;codecs=opus')
    expect(await base64(got as Blob)).toBe(btoa('abc'))
    expect(levels[0]).toBeGreaterThan(0)
    expect(recorder.track.stop).toHaveBeenCalled()
    recorder.restore()
  })
})
