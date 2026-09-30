/** History page: everything Nexo said, filterable by kind, as a day-by-day timeline. */
import { useState } from 'react'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { TipItem, TipSkeleton } from '../components/tip'
import { defineMessages, Language, type MessageKey, useMessages } from '../i18n/i18n'
import { fmtDay } from '../lib/format'
import type { Tip } from '../lib/types'
import { repeat } from '../ui/skeleton'
import { EmptyState, ErrorState } from '../ui/states'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Histórico',
    lead: 'Tudo que o Nexo já te mandou.',
    kinds: {
      all: 'todos',
      start: 'início',
      unlock: 'troféu',
      session: 'sessão',
      route: 'rota',
      server: 'servidor',
      chat: 'chat',
    },
    emptyTitle: 'Nada no histórico ainda',
    empty:
      'Tudo que o Nexo te mandar, dicas, avisos de troféu e fim de sessão, fica guardado aqui.',
    emptyKind: 'nenhuma de {kind} ainda',
    seeAll: 'Ver todos',
    loadFailed:
      'Não conseguimos carregar o histórico. Use o botão de atualizar para tentar novamente.',
  },
  [Language.En]: {
    title: 'History',
    lead: 'Everything Nexo has sent you.',
    kinds: {
      all: 'all',
      start: 'start',
      unlock: 'trophy',
      session: 'session',
      route: 'route',
      server: 'server',
      chat: 'chat',
    },
    emptyTitle: 'Nothing in the history yet',
    empty: 'Everything Nexo sends you, tips, trophy notices and session ends, is kept here.',
    emptyKind: 'no {kind} yet',
    seeAll: 'See all',
    loadFailed: 'We could not load the history. Use the refresh button to try again.',
  },
})

const FILTERS: { kind: string; label: MessageKey<typeof messages> }[] = [
  { kind: '', label: 'kinds.all' },
  { kind: 'start', label: 'kinds.start' },
  { kind: 'unlock', label: 'kinds.unlock' },
  { kind: 'session', label: 'kinds.session' },
  { kind: 'route', label: 'kinds.route' },
  { kind: 'server', label: 'kinds.server' },
  { kind: 'chat', label: 'kinds.chat' },
]
const LABEL = new Map(FILTERS.map((f) => [f.kind, f.label]))

// Grouped by day, newest first (the server already sends them in that order).
function byDay(list: Tip[]) {
  const days = new Map<string, Tip[]>()
  for (const t of list) {
    const key = new Date(t.created_at).toDateString()
    days.set(key, [...(days.get(key) ?? []), t])
  }
  return [...days.values()]
}

function Timeline({ tips, kind, onAll }: { tips: Tip[]; kind: string; onAll: () => void }) {
  const t = useMessages(messages)
  if (!tips.length)
    return (
      <EmptyState icon="history" title={t('emptyTitle')}>
        {t('empty')}
      </EmptyState>
    )
  const filtered = kind ? tips.filter((t) => t.kind === kind) : tips
  if (!filtered.length)
    return (
      <EmptyState
        action={
          <button type="button" className="ghost sm" onClick={onAll}>
            {t('seeAll')}
          </button>
        }
      >
        {t('emptyKind', {
          kind: LABEL.has(kind) ? t(LABEL.get(kind) as MessageKey<typeof messages>) : kind,
        })}
      </EmptyState>
    )
  return (
    <>
      {byDay(filtered).map((group) => (
        <section className="day" key={group[0].created_at}>
          <h3 className="day-label">
            {fmtDay(group[0].created_at)}
            <span>{group.length}</span>
          </h3>
          {group.map((t, i) => (
            <TipItem key={t.id ?? i} tip={t} />
          ))}
        </section>
      ))}
    </>
  )
}

export function History() {
  const t = useMessages(messages)
  const { data, sync, cache } = useApp()
  // The chosen filter survives navigation.
  const [kind, setKindState] = useState(() =>
    typeof cache.tipKind === 'string' ? cache.tipKind : '',
  )
  const setKind = (k: string) => {
    cache.tipKind = k
    setKindState(k)
  }

  return (
    <Page path="/history">
      <div className="page-head">
        <div>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </div>
        <div className="chips" id="tip-filters">
          {FILTERS.map((f) => (
            <button
              key={f.kind}
              type="button"
              className={`chip${kind === f.kind ? ' active' : ''}`}
              data-kind={f.kind}
              onClick={() => setKind(f.kind)}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div id="tips">
          {data ? (
            <Timeline tips={data.tips} kind={kind} onAll={() => setKind('')} />
          ) : sync === 'failed' ? (
            <ErrorState>{t('loadFailed')}</ErrorState>
          ) : (
            repeat(5, () => <TipSkeleton />)
          )}
        </div>
      </div>
    </Page>
  )
}
