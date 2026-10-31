/** Dictation for the chat: speech becomes text in the message box, where the player can fix it
 * before sending. The native app uses the phone's own speech recognition (the speech-recognition
 * plugin, through the Capacitor bridge); a browser uses its Web Speech API. Both are the
 * platform's, so a dictation costs nothing. Where neither exists, there is no mic button. */

/** A dictation under way: stop() ends it and keeps what was heard. */
export interface Dictation {
  stop: () => void
}

interface Callbacks {
  /** The text so far, revised as the recognizer hears more. */
  onText: (text: string) => void
  /** The dictation ended; `error` when the platform refused (no permission, no recognizer). */
  onEnd: (error?: string) => void
}

type Listener = { remove: () => Promise<void> }
interface NativeSpeech {
  available: () => Promise<{ available: boolean }>
  requestPermissions: () => Promise<{ speechRecognition: string }>
  start: (o: { language: string; partialResults: boolean; popup: boolean }) => Promise<unknown>
  stop: () => Promise<void>
  addListener: (
    event: string,
    fn: (data: { matches?: string[]; status?: string }) => void,
  ) => Promise<Listener>
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
export async function dictate(lang: string, { onText, onEnd }: Callbacks): Promise<Dictation> {
  const plugin = native()
  if (plugin) return dictateNative(plugin, lang, onText, onEnd)
  const Ctor = web()
  if (!Ctor) {
    onEnd('unsupported')
    return { stop: () => {} }
  }
  return dictateWeb(Ctor, lang, onText, onEnd)
}

async function dictateNative(
  plugin: NativeSpeech,
  lang: string,
  onText: Callbacks['onText'],
  onEnd: Callbacks['onEnd'],
): Promise<Dictation> {
  const done = (error?: string) => {
    for (const l of listeners) void l.remove()
    onEnd(error)
  }
  const listeners: Listener[] = []
  if (!(await plugin.available()).available) {
    onEnd('unsupported')
    return { stop: () => {} }
  }
  if ((await plugin.requestPermissions()).speechRecognition !== 'granted') {
    onEnd('denied')
    return { stop: () => {} }
  }
  listeners.push(await plugin.addListener('partialResults', (d) => onText(d.matches?.[0] ?? '')))
  listeners.push(
    await plugin.addListener('listeningState', (d) => {
      if (d.status === 'stopped') done()
    }),
  )
  plugin.start({ language: lang, partialResults: true, popup: false }).catch(() => done('failed'))
  return { stop: () => void plugin.stop().catch(() => done()) }
}

function dictateWeb(
  Ctor: WebSpeechCtor,
  lang: string,
  onText: Callbacks['onText'],
  onEnd: Callbacks['onEnd'],
): Dictation {
  const rec = new Ctor()
  rec.lang = lang
  rec.interimResults = true
  // One phrase at a time: it stops by itself after a pause, or on the button.
  rec.continuous = false
  let error: string | undefined
  rec.onresult = (e) => onText(Array.from(e.results, (r) => r[0].transcript).join(''))
  rec.onerror = (e) => {
    error = e.error === 'not-allowed' ? 'denied' : e.error === 'no-speech' ? undefined : 'failed'
  }
  rec.onend = () => onEnd(error)
  rec.start()
  return { stop: () => rec.stop() }
}
