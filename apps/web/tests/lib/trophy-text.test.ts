import { expect, test } from 'bun:test'
import { Language } from '../../src/i18n/locale'
import { trophyDetail, trophyName } from '../../src/lib/trophy-text'

const trophy = { name: 'Marcando o gol', nameEn: 'Scoring', detail: 'Vença', detailEn: 'Win' }

test('a trophy reads in the player’s language, the other one standing in when it is empty', () => {
  expect(trophyName(trophy, Language.En)).toBe('Scoring')
  expect(trophyDetail(trophy, Language.En)).toBe('Win')
  expect(trophyName(trophy, Language.PtBR)).toBe('Marcando o gol')
  expect(trophyDetail(trophy, Language.PtBR)).toBe('Vença')
  // A list with only one language (or an old card without English) still shows a name.
  expect(trophyName({ name: 'Furry Catventurer' }, Language.En)).toBe('Furry Catventurer')
  expect(trophyName({ name: '', nameEn: 'Scoring' }, Language.PtBR)).toBe('Scoring')
  expect(trophyDetail({ detail: null, detailEn: '' }, Language.En)).toBe('')
})
