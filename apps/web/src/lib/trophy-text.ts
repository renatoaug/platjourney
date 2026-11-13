import { getLocale, Language, type Locale } from '../i18n/locale'

/**
 * A trophy's name and description as the player reads them. PSN sends both languages: `name` and
 * `detail` in pt-BR (what a Brazilian console shows), `nameEn` and `detailEn` in English. A player
 * reading English gets the English ones, everyone else the pt-BR ones; when one is empty, the other
 * stands in. Only for what is shown: matching a guide's name or a search keeps both names.
 */
interface TrophyText {
  name: string
  detail?: string | null
  nameEn?: string | null
  detailEn?: string | null
}

type Text = string | null | undefined

const pick = (local: Text, en: Text, locale: Locale) =>
  (locale === Language.En ? en || local : local || en) ?? ''

export const trophyName = (t: Pick<TrophyText, 'name' | 'nameEn'>, locale = getLocale()) =>
  pick(t.name, t.nameEn, locale)

export const trophyDetail = (t: Pick<TrophyText, 'detail' | 'detailEn'>, locale = getLocale()) =>
  pick(t.detail, t.detailEn, locale)
