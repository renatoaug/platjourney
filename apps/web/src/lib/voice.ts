/** The chat's mic. Where the page can record (a browser, and the app's WebView), the question is
 * recorded and the server transcribes it, told the names of the game it is about. Elsewhere the
 * platform's own recognizer dictates it: the phone's speech recognition through the Capacitor
 * plugin, or a browser's Web Speech API. Where nothing can listen, there is no mic button. */

/** A dictation under way: it listens until stop(), which ends it and keeps what was heard. */
export interface Dictation {
  stop: () => void
}

interface Callbacks {
  /** The text so far, revised as the recognizer hears more. */
  onText: (text: string) => void
  /** The dictation ended; `error` when the platform refused (no permission, no recognizer). */
  onEnd: (error?: string) => void
  /** How loud the voice is now, 0 to 1, several times a second: drives the waveform. */
  onLevel?: (level: number) => void
}

type Listener = { remove: () => Promise<void> }
interface NativeSpeech {
  available: () => Promise<{ available: boolean }>
  requestPermissions: () => Promise<{ speechRecognition: string }>
  start: (o: {
    language: string
    partialResults: boolean
    popup: boolean
    continuousPTT: boolean
    muteRecognizerBeep: boolean
  }) => Promise<unknown>
  stop: () => Promise<void>
  addListener: (event: string, fn: (data: NativeEvent) => void) => Promise<Listener>
}
interface NativeEvent {
  matches?: string[]
  /** Text of the earlier runs of a continuous session, and all of it with the current one. */
  accumulated?: string
  accumulatedText?: string
  status?: string
  level?: number
}

interface WebSpeechResult {
  isFinal: boolean
  0: { transcript: string }
}
interface WebSpeech {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: (e: { results: ArrayLike<WebSpeechResult> }) => void
  onerror: (e: { error: string }) => void
  onend: () => void
  start: () => void
  stop: () => void
}
type WebSpeechCtor = new () => WebSpeech

type Win = Window & {
  Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { SpeechRecognition?: NativeSpeech } }
  SpeechRecognition?: WebSpeechCtor
  webkitSpeechRecognition?: WebSpeechCtor
}

const native = (): NativeSpeech | undefined => {
  const cap = (window as Win).Capacitor
  return cap?.isNativePlatform?.() ? cap.Plugins?.SpeechRecognition : undefined
}
const web = (): WebSpeechCtor | undefined =>
  (window as Win).SpeechRecognition ?? (window as Win).webkitSpeechRecognition

/** Whether this device can dictate at all: decides if the mic button shows. */
export function canDictate(): boolean {
  return typeof window !== 'undefined' && Boolean(native() ?? web())
}

/** Starts listening in `lang` ("pt-BR", "en-US"). */
export async function dictate(lang: string, callbacks: Callbacks): Promise<Dictation> {
  const plugin = native()
  if (plugin) return dictateNative(plugin, lang, callbacks)
  const Ctor = web()
  if (!Ctor) {
    callbacks.onEnd('unsupported')
    return { stop: () => {} }
  }
  return dictateWeb(Ctor, lang, callbacks)
}

// Recognizers end by themselves after a pause; here the player ends with the stop button, like a
// voice message. The phone's recognizer keeps the session alive itself (continuousPTT, without the
// beep at each restart). In a browser, a run that ends on its own starts again, keeping what was
// heard; one that ends right after starting (the platform giving up) is not restarted, so it
// cannot spin, and a dictation never runs past MAX_MS.
const MIN_RUN_MS = 500
const MAX_MS = 3 * 60_000
const joined = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b)

async function dictateNative(
  plugin: NativeSpeech,
  lang: string,
  { onText, onEnd, onLevel }: Callbacks,
): Promise<Dictation> {
  const listeners: Listener[] = []
  const done = (error?: string) => {
    for (const l of listeners) void l.remove()
    onEnd(error)
  }
  if (!(await plugin.available()).available) {
    onEnd('unsupported')
    return { stop: () => {} }
  }
  if ((await plugin.requestPermissions()).speechRecognition !== 'granted') {
    onEnd('denied')
    return { stop: () => {} }
  }
  listeners.push(
    await plugin.addListener('partialResults', (d) =>
      onText(d.accumulatedText ?? joined(d.accumulated ?? '', d.matches?.[0] ?? '')),
    ),
    await plugin.addListener('listeningState', (d) => {
      if (d.status === 'stopped') done()
    }),
  )
  if (onLevel) listeners.push(await plugin.addListener('audioLevel', (d) => onLevel(d.level ?? 0)))
  plugin
    .start({
      language: lang,
      partialResults: true,
      popup: false,
      continuousPTT: true,
      muteRecognizerBeep: true,
    })
    .catch(() => done('failed'))
  return { stop: () => void plugin.stop().catch(() => done()) }
}

/** The voice's loudness while recording, for the waveform: how far the samples swing, read every
 * frame from the microphone's stream. */
function meter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const audio = new AudioContext()
  const analyser = audio.createAnalyser()
  analyser.fftSize = 512
  audio.createMediaStreamSource(stream).connect(analyser)
  const samples = new Uint8Array(analyser.fftSize)
  let frame = 0
  const tick = () => {
    analyser.getByteTimeDomainData(samples)
    let sum = 0
    for (const v of samples) sum += ((v - 128) / 128) ** 2
    onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5))
    frame = requestAnimationFrame(tick)
  }
  tick()
  return () => {
    cancelAnimationFrame(frame)
    void audio.close()
  }
}

/** A browser's recognizer does not report loudness, so the page listens to the same microphone.
 * Without it (refused, unsupported) the wave stays flat and the dictation goes on. */
async function meterMic(onLevel: (level: number) => void): Promise<() => void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const close = meter(stream, onLevel)
    return () => {
      close()
      for (const track of stream.getTracks()) track.stop()
    }
  } catch {
    return () => {}
  }
}

function dictateWeb(
  Ctor: WebSpeechCtor,
  lang: string,
  { onText, onEnd, onLevel }: Callbacks,
): Dictation {
  const began = Date.now()
  let kept = ''
  let stopped = false
  let error: string | undefined
  let rec: WebSpeech
  let quiet: Promise<() => void> = Promise.resolve(() => {})
  if (onLevel && typeof navigator.mediaDevices?.getUserMedia === 'function')
    quiet = meterMic(onLevel)
  const run = () => {
    const runAt = Date.now()
    let heard = ''
    rec = new Ctor()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = true
    rec.onresult = (e) => {
      heard = Array.from(e.results, (r) => r[0].transcript).join('')
      onText(joined(kept, heard))
    }
    // Silence is no error: the next run keeps listening.
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') error = 'denied'
      else if (e.error !== 'no-speech' && e.error !== 'aborted') error = 'failed'
    }
    rec.onend = () => {
      kept = joined(kept, heard.trim())
      const now = Date.now()
      if (!stopped && !error && now - runAt >= MIN_RUN_MS && now - began < MAX_MS) return run()
      void quiet.then((close) => close())
      onEnd(error)
    }
    rec.start()
  }
  run()
  return {
    stop: () => {
      stopped = true
      rec.stop()
    },
  }
}

/** A recording under way: stop() ends it and hands the audio to onAudio. */
export interface Recording {
  stop: () => void
}

/** Whether the page can record the question itself, for the server to transcribe. */
export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

// The compressed formats the transcription takes, in order: Chrome and Android record webm,
// Safari and the iPhone mp4.
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

/** Records until stop() or MAX_MS, then hands over the audio; `onEnd('denied')` when the
 * microphone was refused, `onEnd('failed')` when it could not record. */
export async function record({
  onLevel,
  onAudio,
  onEnd,
}: {
  onLevel: (level: number) => void
  onAudio: (audio: Blob) => void
  onEnd: (error?: string) => void
}): Promise<Recording> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    onEnd(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'failed')
    return { stop: () => {} }
  }
  const mimeType = FORMATS.find((f) => MediaRecorder.isTypeSupported?.(f))
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  const quiet = meter(stream, onLevel)
  const limit = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), MAX_MS)
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.onstop = () => {
    clearTimeout(limit)
    quiet()
    for (const track of stream.getTracks()) track.stop()
    const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
    if (audio.size) onAudio(audio)
    onEnd()
  }
  recorder.start()
  return { stop: () => recorder.state !== 'inactive' && recorder.stop() }
}

/** The audio as base64, the way the server takes it. */
export function base64(audio: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(audio)
  })
}
