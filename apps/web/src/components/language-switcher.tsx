/** The language setting on the account screen: Português / English, applied at once and saved to the account. */
import { useState } from 'react'
import { useApp } from '../app/app-state'
import {
  defineMessages,
  getLocale,
  Language,
  LOCALES,
  type Locale,
  setLocale,
  translator,
  useLocale,
  useMessages,
} from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import type { Me } from '../lib/types'
import { toast } from '../ui/toast'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Idioma',
    hint: 'Do app, dos avisos e das mensagens no Telegram.',
    saved: 'Idioma salvo.',
    saveFailed: 'Não conseguimos salvar o idioma. Tenta de novo.',
    // Each language is named in itself, whatever the page is showing.
    names: {
      ptBR: 'Português',
      en: 'English',
    },
  },
  [Language.En]: {
    title: 'Language',
    hint: 'For the app, notices and Telegram messages.',
    saved: 'Language saved.',
    saveFailed: "Couldn't save the language. Try again.",
    names: {
      ptBR: 'Português',
      en: 'English',
    },
  },
})
const translateNow = translator(messages)

const NAME_KEYS = { [Language.PtBR]: 'names.ptBR', [Language.En]: 'names.en' } as const

/** The control alone, for any place that picks a language. */
export function LanguageSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: Locale
  onChange: (locale: Locale) => void
  disabled?: boolean
}) {
  const t = useMessages(messages)
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would restyle the segmented control; the group role names it
    <div className="segmented" role="group" aria-label={t('title')}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={value === locale}
          disabled={disabled}
          onClick={() => value !== locale && onChange(locale)}
        >
          {t(NAME_KEYS[locale])}
        </button>
      ))}
    </div>
  )
}

/** The setting row: switches the page right away, then saves it so notices and Telegram follow. */
export function LanguageSetting() {
  const t = useMessages(messages)
  const locale = useLocale()
  const { me, setMe } = useApp()
  const [saving, setSaving] = useState(false)
  const change = async (next: Locale) => {
    const previous = getLocale()
    setLocale(next)
    setSaving(true)
    try {
      const saved = await api<{ user: Me }>('/api/account/preferences', { locale: next })
      setMe({ ...me, ...saved.user })
      // In the language just picked, not the one this render had.
      toast(translateNow('saved'), 'success')
    } catch (e) {
      setLocale(previous)
      if (!(e instanceof ApiError && e.handled)) toast(translateNow('saveFailed'))
    }
    setSaving(false)
  }
  return (
    <div className="setting-row static">
      <span className="setting-text">
        <b>{t('title')}</b>
        <small>{t('hint')}</small>
      </span>
      <LanguageSwitcher value={locale} onChange={change} disabled={saving} />
    </div>
  )
}
