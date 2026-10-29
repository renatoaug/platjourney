/** The first game in the player's list, as a glass card on the Interests page's top: the platinum
 * they are going for next, how far it is and a way into it. */
import { Link } from 'react-router'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { pct } from '../../lib/format'
import type { Interest } from '../../lib/types'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { titleHref } from '../tip'
import { started } from './season'
import './next-up.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'Próxima platina',
    first: '1º da sua lista',
    notStarted: 'Ainda não começou',
    progress: '{progress}% dos troféus',
    open: 'Abrir jogo',
  },
  [Language.En]: {
    eyebrow: 'Next platinum',
    first: 'First on your list',
    notStarted: 'Not started yet',
    progress: '{progress}% of trophies',
    open: 'Open game',
  },
})

/** The first interest not platinumed yet, in the player's order. */
export const nextUp = (interests: Interest[]) =>
  [...interests].filter((i) => !i.done).sort((a, b) => a.position - b.position)[0] ?? null

export function NextUp({ interest: i }: { interest: Interest }) {
  const t = useMessages(messages)
  const progress = started(i) ? (i.progress ?? 0) : null
  return (
    <aside className="next-up" aria-label={t('eyebrow')}>
      <Cover url={i.game.cover_url} name={i.game.name} className="next-up-cover" />
      <div className="next-up-body">
        <span className="eyebrow">
          {t('eyebrow')} <span>· {t('first')}</span>
        </span>
        <div className="next-up-head">
          <b>{i.game.name}</b>
          <Link className="button sm" to={titleHref(i.game.id)}>
            {t('open')} <Icon name="arrow" />
          </Link>
        </div>
        {progress != null ? (
          <div className="next-up-progress">
            <div className="bar">
              <i style={{ width: `${pct(progress)}%` }} />
            </div>
            <span>{t('progress', { progress })}</span>
          </div>
        ) : (
          <span className="next-up-sub">{t('notStarted')}</span>
        )}
      </div>
    </aside>
  )
}
