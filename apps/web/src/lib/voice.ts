/** The chat's mic: the page records the question and the server transcribes it, told the names of
 * the game it is about. Where the page cannot record, there is no mic button. */

// A recording never runs past this: a mic left on stops by itself.
const MAX_MS = 3 * 60_000

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
