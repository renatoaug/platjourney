import './env.ts'
import { expect, test } from 'bun:test'
import { cleanBuddyName, withBuddyName } from '../../../shared/buddy.ts'
import { defineMessages, Language, translator } from '../src/i18n.ts'

const messages = defineMessages({
  [Language.PtBR]: { asked: 'O Nexo respondeu sua pergunta sobre {game}.' },
  [Language.En]: { asked: 'Nexo answered your question about {game}.' },
})

test("a player's texts say the name they gave their buddy wherever they say Nexo", () => {
  const t = translator(messages, { locale: 'en', buddy_name: 'Zé' })
  expect(t('asked', { game: 'Nexomancer' })).toBe('Zé answered your question about Nexomancer.')
  expect(translator(messages, { locale: 'pt-BR' })('asked', { game: 'Hades' })).toBe(
    'O Nexo respondeu sua pergunta sobre Hades.',
  )
})

test('a name is trimmed, and an empty one means none', () => {
  expect(cleanBuddyName('  Zé   da Silva ')).toBe('Zé da Silva')
  expect(cleanBuddyName('   ')).toBeNull()
  expect(cleanBuddyName(3)).toBeNull()
  expect(withBuddyName('Ask Nexo', null)).toBe('Ask Nexo')
})
