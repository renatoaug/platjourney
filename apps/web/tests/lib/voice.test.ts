import { describe, expect, mock, test } from 'bun:test'
import { base64, canRecord, record } from '../../src/lib/voice'
import { fakeRecorder } from '../support/recorder'

describe('recording', () => {
  test('with no recorder there is no mic', () => {
    expect(canRecord()).toBe(false)
  })

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
