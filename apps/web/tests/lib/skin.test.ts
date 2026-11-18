import { afterEach, expect, test } from 'bun:test'
import { SKINS } from '../../../../shared/skin'
import { applySkin, SKIN_FONTS } from '../../src/lib/skin'

afterEach(() => {
  delete document.documentElement.dataset.skin
  document.getElementById('skin-font')?.remove()
  localStorage.clear()
})

test('a picked skin dresses the page, loads its font and is remembered for the next visit', () => {
  applySkin('neon')
  expect(document.documentElement.dataset.skin).toBe('neon')
  expect(document.getElementById('skin-font')?.getAttribute('href')).toBe(SKIN_FONTS.neon ?? '')
  expect(localStorage.getItem('platjourney:skin')).toBe('neon')
  applySkin('pixel')
  expect(document.querySelectorAll('#skin-font')).toHaveLength(1)
  expect(document.getElementById('skin-font')?.getAttribute('href')).toBe(SKIN_FONTS.pixel ?? '')
})

test('default, nothing or an unknown value is the default look: no attribute, font or memory', () => {
  for (const skin of ['default', undefined, null, 'vaporwave'] as const) {
    applySkin('pixel')
    applySkin(skin as never)
    expect(document.documentElement.dataset.skin).toBeUndefined()
    expect(document.getElementById('skin-font')).toBeNull()
    expect(localStorage.getItem('platjourney:skin')).toBeNull()
  }
})

test('every skin brings its own font, and public/skin.js loads the same one on the first frame', async () => {
  const early = await Bun.file(new URL('../../public/skin.js', import.meta.url)).text()
  for (const skin of SKINS.filter((s) => s !== 'default')) {
    applySkin(skin)
    expect(document.documentElement.dataset.skin).toBe(skin)
    const href = SKIN_FONTS[skin]
    expect(href).toBeTruthy()
    expect(document.getElementById('skin-font')?.getAttribute('href')).toBe(href ?? '')
    expect(early).toContain(href ?? '')
  }
})
