import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import {
  handoffLaunchScreen,
  hideLaunchScreen,
  isNative,
  tick,
  tickOnChoices,
} from '../../src/lib/native'

const w = window as Window & { Capacitor?: unknown }

afterEach(() => {
  mock.restore()
  delete w.Capacitor
  document.body.innerHTML = ''
})

describe('native bridge', () => {
  test('a browser has no bridge: nothing is native and a tick does nothing', () => {
    expect(isNative()).toBe(false)
    expect(() => tick()).not.toThrow()
    const frame = spyOn(globalThis, 'requestAnimationFrame')
    handoffLaunchScreen()()
    expect(frame).not.toHaveBeenCalled()
  })

  test('in the app, a tap on a tab ticks and a tap elsewhere does not', () => {
    const selectionChanged = mock(() => Promise.resolve())
    w.Capacitor = { isNativePlatform: () => true, Plugins: { Haptics: { selectionChanged } } }
    expect(isNative()).toBe(true)
    tickOnChoices()
    document.body.innerHTML = '<button role="tab"><span>Tab</span></button><p>text</p>'
    document.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.querySelector('p')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(selectionChanged).toHaveBeenCalledTimes(1)
  })

  test('in the app, the launch screen fades out when asked', () => {
    const hide = mock(() => Promise.resolve())
    w.Capacitor = { isNativePlatform: () => true, Plugins: { SplashScreen: { hide } } }
    hideLaunchScreen()
    expect(hide).toHaveBeenCalledWith({ fadeOutDuration: 200 })
  })
})

function launch() {
  const hide = mock(() => Promise.resolve())
  w.Capacitor = { isNativePlatform: () => true, Plugins: { SplashScreen: { hide } } }
  const frames: FrameRequestCallback[] = []
  spyOn(globalThis, 'requestAnimationFrame').mockImplementation((fn) => {
    frames.push(fn)
    return frames.length
  })
  spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  return { hide, paint: () => frames.shift()?.(0) }
}

test('launch waits for the mascot to decode and a painted frame', async () => {
  const { hide, paint } = launch()
  document.body.innerHTML = '<img class="boot-nexo" alt="">'
  const image = document.querySelector('img') as HTMLImageElement
  let decoded = () => {}
  image.decode = () =>
    new Promise<void>((resolve) => {
      decoded = resolve
    })
  const stop = handoffLaunchScreen()
  paint()
  expect(hide).not.toHaveBeenCalled()
  decoded()
  await Promise.resolve()
  await Promise.resolve()
  paint()
  expect(hide).not.toHaveBeenCalled()
  paint()
  expect(hide).toHaveBeenCalledTimes(1)
  stop()
})

test('a broken mascot still hands over to the painted page', async () => {
  const { hide, paint } = launch()
  document.body.innerHTML = '<img class="boot-nexo" alt="">'
  const image = document.querySelector('img') as HTMLImageElement
  image.decode = () => Promise.reject(new Error('image unavailable'))
  const stop = handoffLaunchScreen()
  await Promise.resolve()
  await Promise.resolve()
  paint()
  paint()
  expect(hide).toHaveBeenCalledTimes(1)
  stop()
})

test('a stalled decode has a bounded wait and cannot hide twice when it later resolves', async () => {
  const { hide, paint } = launch()
  document.body.innerHTML = '<img class="boot-nexo" alt="">'
  const image = document.querySelector('img') as HTMLImageElement
  let decoded = () => {}
  image.decode = () =>
    new Promise<void>((resolve) => {
      decoded = resolve
    })
  let expire = () => {}
  spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
    expire = fn
    return 1
  }) as typeof setTimeout)
  const stop = handoffLaunchScreen()
  expire()
  paint()
  paint()
  expect(hide).toHaveBeenCalledTimes(1)
  decoded()
  await Promise.resolve()
  await Promise.resolve()
  paint()
  paint()
  expect(hide).toHaveBeenCalledTimes(1)
  stop()
})

test('cleanup cancels the old mount while a replacement can finish without a boot image', () => {
  const { hide, paint } = launch()
  const old = handoffLaunchScreen()
  old()
  paint()
  paint()
  expect(hide).not.toHaveBeenCalled()
  const current = handoffLaunchScreen()
  paint()
  paint()
  expect(hide).toHaveBeenCalledTimes(1)
  current()
})
