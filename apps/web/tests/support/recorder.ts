import { mock } from 'bun:test'

type W = Window & { MediaRecorder?: unknown; AudioContext?: unknown }

/** A page that can record: a microphone stream, a MediaRecorder that hands back `heard` on stop
 * and an AudioContext whose samples swing, so the wave moves. `restore()` takes it all away. */
export function fakeRecorder({ heard = 'abc', refuse = false } = {}) {
  const w = window as W
  const before = navigator.mediaDevices
  const track = { stop: mock(() => {}) }
  const stream = { getTracks: () => [track] }
  const getUserMedia = mock(async () => {
    if (refuse) throw new DOMException('no', 'NotAllowedError')
    return stream
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  w.MediaRecorder = class {
    static isTypeSupported = (f: string) => f === 'audio/webm;codecs=opus'
    state = 'inactive'
    mimeType: string
    ondataavailable = (_e: { data: Blob }) => {}
    onstop = () => {}
    constructor(_s: unknown, o?: { mimeType?: string }) {
      this.mimeType = o?.mimeType ?? ''
    }
    start() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      this.ondataavailable({ data: new Blob([heard], { type: this.mimeType }) })
      this.onstop()
    }
  }
  w.AudioContext = class {
    createAnalyser() {
      return { fftSize: 0, getByteTimeDomainData: (a: Uint8Array) => a.fill(200) }
    }
    createMediaStreamSource() {
      return { connect: () => {} }
    }
    close() {
      return Promise.resolve()
    }
  }
  return {
    track,
    getUserMedia,
    restore() {
      delete w.MediaRecorder
      delete w.AudioContext
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: before })
    },
  }
}
