/** Online server alerts for the games closest to the platinum (the inside of `.card#servers`). */

import { defineMessages, Language, type MessageKey, useMessages } from '../i18n/i18n'
import { plainText } from '../lib/text'
import type { ServerStatus } from '../lib/types'
import { Icon } from '../ui/icon'
import { repeat, Sk } from '../ui/skeleton'
import { EmptyState } from '../ui/states'
import './servers.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Servidores online',
    active: 'Online',
    announced: 'Fecha em',
    closed: 'Fechado',
    emptyTitle: 'Tudo no ar',
    empty: 'Nenhum servidor fechando nos seus jogos perto da platina.',
  },
  [Language.En]: {
    title: 'Online servers',
    active: 'Online',
    announced: 'Closes on',
    closed: 'Closed',
    emptyTitle: 'All online',
    empty: 'No servers closing for your games close to the platinum.',
  },
})

/** /api/state sends the row with its date and note too. */
export type ServerAlert = ServerStatus & { date?: string | null; note?: string | null }

const LABEL: Record<string, { icon: string; text: MessageKey<typeof messages> }> = {
  active: { icon: 'globe', text: 'active' },
  announced: { icon: 'warning', text: 'announced' },
  closed: { icon: 'close', text: 'closed' },
}

export function Servers({ list }: { list: ServerAlert[] }) {
  const t = useMessages(messages)
  return (
    <>
      <h2>{t('title')}</h2>
      {list.length ? (
        list.map((s) => {
          const label = LABEL[s.status]
          return (
            <div key={s.id} className={s.status === 'active' ? undefined : `alert ${s.status}`}>
              <b>{s.game?.name}</b>{' '}
              <span className="server-status">
                {label && (
                  <>
                    <Icon name={label.icon} /> {t(label.text)}
                  </>
                )}{' '}
                {s.date ?? ''}
              </span>
              <br />
              <small className="muted">{plainText(s.note ?? '')}</small>
            </div>
          )
        })
      ) : (
        <EmptyState icon="check" title={t('emptyTitle')}>
          {t('empty')}
        </EmptyState>
      )}
    </>
  )
}

export function ServersSkeleton({ n = 3 }: { n?: number }) {
  const t = useMessages(messages)
  return (
    <>
      <h2>{t('title')}</h2>
      {repeat(n, () => (
        <div style={{ padding: '8px 0' }}>
          <Sk w="50%" h={12} />
          <Sk w="80%" h={10} style={{ marginTop: 8 }} />
        </div>
      ))}
    </>
  )
}
