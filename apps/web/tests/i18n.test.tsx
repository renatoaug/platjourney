import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Glob } from 'bun'
import { MockAppState } from '../src/app/app-state'
import { LanguageSetting, LanguageSwitcher } from '../src/components/language-switcher'
import {
  applySavedLocale,
  declaredMessages,
  defineMessages,
  getLocale,
  I18nProvider,
  resolveLocale,
  setLocale,
  translator,
  useMessages,
} from '../src/i18n/i18n'
import { fromLanguage } from '../src/i18n/locale'
import {
  flatKeys,
  interpolate,
  lookup,
  pickPlural,
  type Tree,
  translate,
} from '../src/i18n/translate'
import { fmtDay, fmtHours, number } from '../src/lib/format'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

// The sets this file declares to test defineMessages itself; the app-wide check skips them.
const mine = new Set<object>()
const own = ((m: Parameters<typeof defineMessages>[0]) => {
  const set = defineMessages(m)
  mine.add(set)
  return set
}) as typeof defineMessages

const messages = own({
  'pt-BR': {
    hello: 'Olá, {name}!',
    games: { one: '{count} jogo', other: '{count} jogos' },
    nested: { deep: 'fundo' },
  },
  en: {
    hello: 'Hello, {name}!',
    games: { one: '{count} game', other: '{count} games' },
    nested: { deep: 'deep' },
  },
})

describe('defineMessages', () => {
  test('en must have exactly the keys and plural categories of pt-BR', () => {
    // Each mistake below is a type error; `bun run typecheck` fails if one stops being flagged.
    own({
      'pt-BR': { title: 'a', other: 'b' },
      // @ts-expect-error a missing key
      en: { title: 'a' },
    })
    own({
      'pt-BR': { title: 'a' },
      // @ts-expect-error an extra key
      en: { title: 'a', extra: 'b' },
    })
    own({
      'pt-BR': { group: { a: 'a' } },
      // @ts-expect-error an extra nested key
      en: { group: { a: 'a', b: 'b' } },
    })
    own({
      'pt-BR': { n: { one: 'a', other: 'b' } },
      // @ts-expect-error a missing plural category
      en: { n: { other: 'b' } },
    })
    own({
      'pt-BR': { n: { one: 'a', other: 'b' } },
      // @ts-expect-error a text where pt-BR has a plural
      en: { n: 'b' },
    })
    const t = translator(messages)
    // @ts-expect-error an unknown key
    expect(t('nope')).toBe('nope')
    // @ts-expect-error a group is not a text
    expect(t('nested')).toBe('nested')
  })

  test('translator reads the active locale on every call, or the one it was given', () => {
    const t = translator(messages)
    expect(t('hello', { name: 'Ana' })).toBe('Olá, Ana!')
    expect(t('nested.deep')).toBe('fundo')
    expect(t('games', { count: 1 })).toBe('1 jogo')
    expect(t('games', { count: 0 })).toBe('0 jogos')
    setLocale('en', { persist: false })
    expect(t('hello', { name: 'Ana' })).toBe('Hello, Ana!')
    expect(t('games', { count: 1 })).toBe('1 game')
    expect(t('games', { count: 0 })).toBe('0 games')
    expect(translator(messages, 'pt-BR')('games', { count: 2 })).toBe('2 jogos')
  })
})

/** Every message set in the app: importing each module runs its `defineMessages`. */
async function everyMessageSet() {
  const root = `${import.meta.dir}/../src/`
  for await (const file of new Glob('**/*.{ts,tsx}').scan({ cwd: root })) {
    if (/(\.stories\.tsx|\.d\.ts|^main\.tsx)$/.test(file)) continue
    await import(root + file)
  }
  return declaredMessages()
    .filter((set) => !mine.has(set))
    .map((set) => ({
      file: JSON.stringify(set['pt-BR']).slice(0, 40),
      pt: set['pt-BR'],
      en: set.en as Tree,
    }))
}

describe('every message set in the app', () => {
  test('both languages have the same keys, the same placeholders and no empty text', async () => {
    const sets = await everyMessageSet()
    expect(sets.length).toBeGreaterThan(30)
    const names = (s: string) =>
      [...s.matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .filter((n) => n !== 'count')
        .sort()
    for (const { file, pt, en } of sets) {
      expect({ file, keys: flatKeys(en) }).toEqual({ file, keys: flatKeys(pt) })
      for (const key of flatKeys(pt)) {
        const ptText = translate(pt, pt, 'pt-BR', key, { count: 2 })
        const enText = translate(en, pt, 'en', key, { count: 2 })
        expect(enText).not.toBe('')
        expect({ file, key, names: names(enText) }).toEqual({ file, key, names: names(ptText) })
      }
    }
  })
})

describe('translate', () => {
  const tree = {
    hello: 'Olá, {name}!',
    games: { one: '{count} jogo', other: '{count} jogos', zero: 'nenhum jogo' },
    nested: { deep: 'fundo' },
  }

  test('finds nested keys and plurals, and nothing else', () => {
    expect(lookup(tree, 'nested.deep')).toBe('fundo')
    expect(lookup(tree, 'games')).toEqual(tree.games)
    expect(lookup(tree, 'nested')).toBeUndefined()
    expect(lookup(tree, 'games.one')).toBeUndefined()
    expect(lookup(tree, 'missing.key')).toBeUndefined()
  })

  test('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('Olá, {name}!', { name: 'Ana' })).toBe('Olá, Ana!')
    expect(interpolate('{a} e {b}', { a: 1 })).toBe('1 e {b}')
    expect(interpolate('{a}', { a: null })).toBe('{a}')
    expect(interpolate('sem nada')).toBe('sem nada')
  })

  test('picks plurals by the language rules, with zero when given', () => {
    expect(pickPlural(tree.games, 1, 'pt-BR')).toBe('{count} jogo')
    expect(pickPlural(tree.games, 2, 'pt-BR')).toBe('{count} jogos')
    expect(pickPlural(tree.games, 0, 'pt-BR')).toBe('nenhum jogo')
    expect(pickPlural({ one: 'one', other: 'other' }, 0, 'en')).toBe('other')
    expect(pickPlural({ one: '{count} jogo', other: '{count} jogos' }, 0, 'pt-BR')).toBe(
      '{count} jogos',
    )
    expect(pickPlural({ other: 'only' }, 1, 'en')).toBe('only')
  })

  test('falls back to pt-BR, then to the key', () => {
    expect(translate({}, tree, 'en', 'hello', { name: 'Ana' })).toBe('Olá, Ana!')
    expect(translate({}, tree, 'en', 'nope')).toBe('nope')
    expect(translate(tree, tree, 'pt-BR', 'games', { count: 3 })).toBe('3 jogos')
  })
})

describe('locale resolution', () => {
  test("the account's choice, then the browser's memory, then its language", () => {
    expect(resolveLocale({ saved: 'en', stored: 'pt-BR', language: 'pt-BR' })).toBe('en')
    expect(resolveLocale({ saved: null, stored: 'en', language: 'pt-BR' })).toBe('en')
    expect(resolveLocale({ saved: 'fr', stored: 'xx', language: 'pt-PT' })).toBe('pt-BR')
    expect(resolveLocale({ language: 'de-DE' })).toBe('en')
    expect(resolveLocale({})).toBe('en')
    expect(fromLanguage('PT')).toBe('pt-BR')
  })

  test('setting it updates <html lang> and is remembered unless asked not to', () => {
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('locale')).toBe('en')
    localStorage.clear()
    setLocale('pt-BR', { persist: false })
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(localStorage.getItem('locale')).toBeNull()
  })

  test("after sign-in the account's choice wins; without one the browser's memory stays", () => {
    localStorage.setItem('locale', 'en')
    applySavedLocale(null)
    expect(getLocale()).toBe('en')
    applySavedLocale('pt-BR')
    expect(getLocale()).toBe('pt-BR')
    expect(localStorage.getItem('locale')).toBe('pt-BR')
  })
})

describe('in the app', () => {
  function Greeting({ count }: { count: number }) {
    const t = useMessages(messages)
    return (
      <p>
        {t('hello', { name: 'Ana' })} {t('games', { count })}
      </p>
    )
  }

  test('components show the new language as soon as it changes', () => {
    render(<Greeting count={0} />)
    expect(screen.getByText('Olá, Ana! 0 jogos')).toBeTruthy()
    act(() => setLocale('en', { persist: false }))
    expect(screen.getByText('Hello, Ana! 0 games')).toBeTruthy()
  })

  test('the provider can force a language', () => {
    render(
      <I18nProvider locale="en">
        <Greeting count={1} />
      </I18nProvider>,
    )
    expect(screen.getByText('Hello, Ana! 1 game')).toBeTruthy()
  })

  test('numbers and dates follow the language', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(number(12345)).toBe('12.345')
    expect(fmtHours(2.5)).toBe('2,5h')
    expect(fmtDay(new Date().toISOString())).toBe('Hoje')
    expect(fmtDay(yesterday)).toBe('Ontem')
    setLocale('en', { persist: false })
    expect(number(12345)).toBe('12,345')
    expect(fmtHours(2.5)).toBe('2.5h')
    expect(fmtHours(12.4)).toBe('12h')
    expect(fmtDay(new Date().toISOString())).toBe('Today')
    expect(fmtDay(yesterday)).toBe('Yesterday')
  })
})

describe('language switcher', () => {
  test('marks the current language and reports a new pick', () => {
    const onChange = mock()
    render(<LanguageSwitcher value="pt-BR" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Português' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Português' }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(onChange).toHaveBeenCalledWith('en')
  })

  test('the setting switches the page at once and saves it to the account', async () => {
    const calls: { url: string; body: string; language: string }[] = []
    globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      calls.push({ url, body: String(init?.body), language: headers['accept-language'] })
      return new Response(JSON.stringify({ user: { locale: 'en' } }), { status: 200 })
    }) as unknown as typeof fetch
    render(
      <MockAppState>
        <LanguageSetting />
      </MockAppState>,
    )
    expect(screen.getByText('Idioma')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'English' }))
    })
    expect(getLocale()).toBe('en')
    expect(screen.getByText('Language')).toBeTruthy()
    expect(calls).toEqual([
      { url: '/api/account/preferences', body: '{"locale":"en"}', language: 'en' },
    ])
  })

  test('a failed save puts the previous language back', async () => {
    globalThis.fetch = mock(
      async () => new Response('{}', { status: 500 }),
    ) as unknown as typeof fetch
    render(
      <MockAppState>
        <LanguageSetting />
      </MockAppState>,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'English' }))
    })
    expect(getLocale()).toBe('pt-BR')
    expect(screen.getByText('Idioma')).toBeTruthy()
  })
})
