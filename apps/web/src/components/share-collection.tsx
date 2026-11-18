/** Sharing the platinums of this month, this year or all of them as one image: a button that
 * opens the three choices. */
import { useEffect, useRef, useState } from 'react'
import { defineMessages, getLocale, Language, useMessages } from '../i18n/i18n'
import { drawCollectionCard, fetchCollectionCard, type Period } from '../lib/share-collection'
import { Icon } from '../ui/icon'
import { useShare } from './share-platinum'
import './share-platinum.css'

const messages = defineMessages({
  [Language.PtBR]: {
    share: 'Compartilhar',
    choose: 'Compartilhar platinas',
    month: 'Deste mês',
    year: 'Deste ano',
    all: 'Todas',
    textMonth: { one: 'Minha platina de {when} 🏆', other: 'Minhas {count} platinas de {when} 🏆' },
    textYear: { one: 'Minha platina de {when} 🏆', other: 'Minhas {count} platinas de {when} 🏆' },
    textAll: { one: 'Minha primeira platina 🏆', other: 'Minhas {count} platinas 🏆' },
    empty: 'Nenhuma platina neste período ainda.',
  },
  [Language.En]: {
    share: 'Share',
    choose: 'Share platinums',
    month: 'This month',
    year: 'This year',
    all: 'All of them',
    textMonth: { one: 'My {when} platinum 🏆', other: 'My {count} platinums of {when} 🏆' },
    textYear: { one: 'My {when} platinum 🏆', other: 'My {count} platinums of {when} 🏆' },
    textAll: { one: 'My first platinum 🏆', other: 'My {count} platinums 🏆' },
    empty: 'No platinum in this period yet.',
  },
})

const PERIODS: Period[] = ['month', 'year', 'all']
const TEXT = { month: 'textMonth', year: 'textYear', all: 'textAll' } as const

export function ShareCollection() {
  const t = useMessages(messages)
  const { busy, run, panel } = useShare()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)

  // Open: a tap outside or Escape closes it.
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const share = (period: Period) => {
    setOpen(false)
    return run(async () => {
      const card = await fetchCollectionCard(period)
      if (!card.total) return t('empty')
      const now = new Date()
      const when =
        period === 'month'
          ? new Intl.DateTimeFormat(getLocale(), { month: 'long' }).format(now)
          : String(now.getFullYear())
      return {
        blob: await drawCollectionCard(card),
        name: `platinas-${period === 'all' ? 'todas' : period === 'year' ? when : `${now.getFullYear()}-${now.getMonth() + 1}`}.png`,
        text: t(TEXT[period], { count: card.total, when }),
        onlineId: card.player.onlineId,
      }
    })
  }

  return (
    <span className="share-collection" ref={root}>
      <button
        type="button"
        className="button secondary share-platinum-labeled"
        aria-haspopup="true"
        aria-expanded={open}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="share" /> {t('share')}
      </button>
      {open && (
        <fieldset className="share-collection-menu" aria-label={t('choose')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => share(p)}>
              {t(p)}
            </button>
          ))}
        </fieldset>
      )}
      {panel}
    </span>
  )
}
