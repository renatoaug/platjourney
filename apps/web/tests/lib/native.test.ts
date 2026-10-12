import { afterEach, describe, expect, mock, test } from 'bun:test'
import { hideLaunchScreen, isNative, tick, tickOnChoices } from '../../src/lib/native'

const w = window as Window & { Capacitor?: unknown }

afterEach(() => {
  delete w.Capacitor
  document.body.innerHTML = ''
})

describe('native bridge', () => {
  test('a browser has no bridge: nothing is native and a tick does nothing', () => {
    expect(isNative()).toBe(false)
    expect(() => tick()).not.toThrow()
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
