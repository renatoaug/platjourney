import './env.ts'
import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import {
  declaredMessages,
  defineMessages,
  flatKeys,
  fmtRate,
  fromAcceptLanguage,
  fromLanguage,
  type Tree,
  translate,
  translator,
  userLocale,
} from '../src/i18n.ts'
import { routeNotice } from '../src/route.ts'
import { telegramMessages } from '../src/telegram.ts'

// The sets this file declares to test defineMessages itself; the app-wide check skips them.
const mine = new Set<object>()
const own = ((m: Parameters<typeof defineMessages>[0]) => {
  const set = defineMessages(m)
  mine.add(set)
  return set
}) as typeof defineMessages

const messages = own({
  'pt-BR': {
    loading: 'Carregando {name}…',
    next: {
      one: '{n}. {name} — {progress}%, falta {count} troféu',
      other: '{n}. {name} — {progress}%, faltam {count} troféus',
    },
    nested: { deep: 'fundo' },
  },
  en: {
    loading: 'Loading {name}…',
    next: {
      one: '{n}. {name} — {progress}%, {count} trophy left',
      other: '{n}. {name} — {progress}%, {count} trophies left',
    },
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
    const t = translator(messages, 'en')
    // @ts-expect-error an unknown key comes back as itself
    expect(t('nope.missing')).toBe('nope.missing')
    // @ts-expect-error a group is not a text
    expect(t('nested')).toBe('nested')
  })

  test('fills the placeholders it is given and leaves the others visible', () => {
    expect(translator(messages, 'pt-BR')('loading', { name: 'Days Gone' })).toBe(
      'Carregando Days Gone…',
    )
    expect(translator(messages, 'en')('loading', { name: 'Days Gone' })).toBe('Loading Days Gone…')
    expect(translator(messages, 'en')('loading')).toBe('Loading {name}…')
    expect(translator(messages, { locale: 'en' })('nested.deep')).toBe('deep')
    expect(translator(messages, null)('nested.deep')).toBe('fundo')
  })

  test('picks the plural form by count, in each language, with zero as plural', () => {
    const next = (locale: 'pt-BR' | 'en', count: number) =>
      translator(messages, locale)('next', { n: 1, name: 'Astro Bot', progress: 90, count })
    expect(next('pt-BR', 1)).toBe('1. Astro Bot — 90%, falta 1 troféu')
    expect(next('pt-BR', 3)).toBe('1. Astro Bot — 90%, faltam 3 troféus')
    expect(next('en', 1)).toBe('1. Astro Bot — 90%, 1 trophy left')
    expect(next('en', 3)).toBe('1. Astro Bot — 90%, 3 trophies left')
    expect(next('pt-BR', 0)).toBe('1. Astro Bot — 90%, faltam 0 troféus')
  })

  test('falls back to pt-BR, then to the key', () => {
    const pt = messages['pt-BR']
    expect(translate({}, pt, 'en', 'loading', { name: 'Ana' })).toBe('Carregando Ana…')
    expect(translate({}, pt, 'en', 'nope')).toBe('nope')
    expect(translate(pt, pt, 'pt-BR', 'next.one')).toBe('next.one')
  })
})

/** Every message set in the server: importing each module runs its `defineMessages`. */
async function everyMessageSet() {
  const root = `${import.meta.dir}/../src/`
  for await (const file of new Glob('**/*.ts').scan({ cwd: root })) {
    // index.ts starts the bot and the web server when loaded.
    if (file === 'index.ts') continue
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

describe('every message set in the server', () => {
  test('both languages have the same keys, the same placeholders and no empty text', async () => {
    const sets = await everyMessageSet()
    expect(sets.length).toBeGreaterThanOrEqual(12)
    // `count` is how a plural picks its form; one form may leave it out.
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
        expect(ptText).not.toBe('')
        expect(enText).not.toBe('')
        expect({ file, key, names: names(enText) }).toEqual({ file, key, names: names(ptText) })
      }
    }
  })
})

describe('locale resolution', () => {
  test('any Portuguese is pt-BR, anything else English', () => {
    expect(fromLanguage('pt')).toBe('pt-BR')
    expect(fromLanguage('pt-PT')).toBe('pt-BR')
    expect(fromLanguage('en-GB')).toBe('en')
    expect(fromLanguage('es')).toBe('en')
    expect(fromLanguage(undefined)).toBe('en')
  })

  test('reads the first language of Accept-Language', () => {
    expect(fromAcceptLanguage('en-US,en;q=0.9,pt;q=0.8')).toBe('en')
    expect(fromAcceptLanguage('pt-BR;q=1, en;q=0.5')).toBe('pt-BR')
    expect(fromAcceptLanguage('')).toBeUndefined()
    expect(fromAcceptLanguage(undefined)).toBeUndefined()
  })

  test('a player who never chose keeps pt-BR', () => {
    expect(userLocale({ locale: 'en' })).toBe('en')
    expect(userLocale({ locale: null })).toBe('pt-BR')
    expect(userLocale({ locale: 'fr' })).toBe('pt-BR')
    expect(userLocale(undefined)).toBe('pt-BR')
    expect(translator(telegramMessages, { locale: 'en' })('unknownCommand')).toBe(
      "I don't know that command.",
    )
    expect(translator(telegramMessages, { locale: null })('unknownCommand')).toBe(
      'Não conheço esse comando.',
    )
  })
})

test('the route notice header follows the player, the tips stay as the guide wrote them', () => {
  const milestone = {
    after: 'Fim do Capítulo 1',
    tips: [{ kind: 'missable' as const, text: 'Leia a carta.', trophy: null }],
  }
  expect(routeNotice(milestone, 'en')).toBe('Worth knowing now:\n• Leia a carta.')
  expect(routeNotice({ after: null, tips: [] }, 'en')).toBe('Before you start:')
})

test('a trophy rate shows at most one decimal in the player language', () => {
  expect(fmtRate('pt-BR', 11.700000000000001)).toBe('11,7')
  expect(fmtRate('en', 11.700000000000001)).toBe('11.7')
  expect(fmtRate('en', 3)).toBe('3')
})
